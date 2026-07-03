/**
 * SupabaseAuth.js v1.0.2
 * Biblioteca de autenticação robusta para integração Supabase + Bubble.io
 */

if (typeof window.SupabaseAuth === "undefined") {
  window.SupabaseAuth = (() => {
    // --- ESTADO PRIVADO DA BIBLIOTECA ---
    const _version = "1.0.2";
    
    const _config = {
      url: "",
      anonKey: "",
      loginPage: "login",
      homePage: "inicio",
      debug: false,
      storageKey: "supabase.auth.token"
    };

    const _state = {
      initialized: false,
      session: null,
      user: null,
      isLogged: false
    };

    let _client = null;
    const _eventListeners = new Map();

    const _utils = {
      log(message, type = "success") {
        if (!_config.debug) return;
        const symbols = { success: "✔", error: "❌", info: "ℹ" };
        console.log(`%c${symbols[type] || "•"} ${message}`, "color: #3b82f6; font-weight: bold;");
      },
      error(message, errorObj = null) {
        if (_config.debug) {
          console.error(`❌ Erro em SupabaseAuth: ${message}`, errorObj);
        }
        _utils.trigger("ERROR", { message, error: errorObj });
      },
      trigger(event, data) {
        if (_eventListeners.has(event)) {
          _eventListeners.get(event).forEach(callback => {
            try { callback(data); } catch (e) { console.error(e); }
          });
        }
      }
    };

    const _bubble = {
      sync(authEvent, session) {
        _state.session = session;
        _state.user = session?.user || null;
        _state.isLogged = !!session;

        if (typeof window.bubble_fn_auth === "function") {
          window.bubble_fn_auth(authEvent);
        }
        if (typeof window.bubble_fn_session === "function") {
          window.bubble_fn_session(session);
        }
        if (typeof window.bubble_fn_user === "function") {
          window.bubble_fn_user(_state.user);
        }

        _utils.log("Bubble sincronizado", "success");
      }
    };

    const _storage = {
      syncFromSupabase(session) {
        if (!session) {
          localStorage.removeItem(_config.storageKey);
          return;
        }
        localStorage.setItem(_config.storageKey, JSON.stringify(session));
      }
    };

    const _redirect = {
      to(page) {
        if (typeof window !== "undefined") {
          window.location.href = `/${page}`;
        }
      }
    };

    return {
      get version() { return _version; },
      get config() { return { ..._config }; },
      get state() { return { ..._state }; },
      get client() { return _client; },

      async init(options = {}) {
        if (_state.initialized) {
          _utils.log("SDK já estava inicializado. Ignorando re-inicialização.", "info");
          return true;
        }

        if (typeof window === "undefined" || !window.supabase) {
          _utils.error("O SDK do Supabase não foi encontrado na janela global (window.supabase).");
          return false;
        }

        Object.assign(_config, options);

        try {
          _client = window.supabase.createClient(_config.url, _config.anonKey, {
            auth: {
              storageKey: _config.storageKey,
              autoRefreshToken: true,
              persistSession: true
            }
          });

          _state.initialized = true;
          _utils.log("SDK iniciado", "success");

          _client.auth.onAuthStateChange((event, session) => {
            _storage.syncFromSupabase(session);
            _bubble.sync(event, session);
            
            if (event === "SIGNED_IN") _utils.log("Login realizado", "success");
            if (event === "SIGNED_OUT") _utils.log("Logout", "success");
            if (event === "TOKEN_REFRESHED") _utils.log("Token renovado", "success");

            _utils.trigger(event, session);
          });

          const { data: { session } } = await _client.auth.getSession();
          if (session) {
            _utils.log("Sessão restaurada", "success");
            _utils.trigger("INITIALIZED", session);
          }

          return true;
        } catch (err) {
          _utils.error("Falha ao inicializar o SupabaseAuth", err);
          return false;
        }
      },

      on(event, callback) {
        if (typeof callback !== "function") return;
        if (!_eventListeners.has(event)) {
          _eventListeners.set(event, []);
        }
        _eventListeners.get(event).push(callback);
      },

      getSession() { return _state.session; },
      getUser() { return _state.user; },
      isLogged() { return _state.isLogged; },

      requireAuth() {
        if (!_state.isLogged) {
          _utils.log(`Acesso negado. Redirecionando para: ${_config.loginPage}`, "info");
          _redirect.to(_config.loginPage);
          return false;
        }
        return true;
      },

      redirectIfLogged() {
        if (_state.isLogged) {
          _utils.log(`Usuário já logado. Redirecionando para: ${_config.homePage}`, "info");
          _redirect.to(_config.homePage);
          return true;
        }
        return false;
      },

      async login(provider) {
        if (!_state.initialized) return _utils.error("SDK não inicializado.");
        
        const { data, error } = await _client.auth.signInWithOAuth({
          provider: provider,
          options: {
            redirectTo: window.location.origin + "/" + _config.homePage
          }
        });

        if (error) { _utils.error(`Erro no login via ${provider}`, error); throw error; }
        return data;
      },

      async loginGoogle() { return this.login("google"); },

      async loginEmail(email, password) {
        if (!_state.initialized) return _utils.error("SDK não inicializado.");
        
        const { data, error } = await _client.auth.signInWithPassword({ email, password });
        if (error) { _utils.error("Erro no login por e-mail", error); throw error; }
        return data;
      },

      async signup(email, password, userMetadata = {}) {
        if (!_state.initialized) return _utils.error("SDK não inicializado.");
        
        const { data, error } = await _client.auth.signUp({
          email,
          password,
          options: { data: userMetadata }
        });
        if (error) { _utils.error("Erro no cadastro", error); throw error; }
        return data;
      },

      async logout() {
        if (!_state.initialized) return _utils.error("SDK não inicializado.");
        const { error } = await _client.auth.signOut();
        if (error) { _utils.error("Erro ao deslogar", error); throw error; }
      },

      async recoverPassword(email) {
        if (!_state.initialized) return _utils.error("SDK não inicializado.");
        
        const { data, error } = await _client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/" + _config.loginPage
        });
        if (error) { _utils.error("Erro ao solicitar recuperação de senha", error); throw error; }
        return data;
      },

      async updatePassword(newPassword) {
        if (!_state.initialized) return _utils.error("SDK não inicializado.");
        
        const { data, error } = await _client.auth.updateUser({ password: newPassword });
        if (error) { _utils.error("Erro ao atualizar senha", error); throw error; }
        return data;
      },

      async updateUser(metadata = {}) {
        if (!_state.initialized) return _utils.error("SDK não inicializado.");
        
        const { data, error } = await _client.auth.updateUser({ data: metadata });
        if (error) { _utils.error("Erro ao atualizar metadados do usuário", error); throw error; }
        return data;
      }
    };
  })();
}
```
eof

---

### Como contornar o problema da CDN imediatamente?

Como o jsDelivr vai demorar para notar que o arquivo mudou, use uma destas **3 soluções** para o seu teste funcionar agora mesmo:

#### Solução A: Usar a CDN de Desenvolvimento (Reflete na hora!)
Durante o desenvolvimento, use a ferramenta **Raw GitHack**, que não guarda cache por muito tempo. Substitua a tag `<script>` no seu header do Bubble por esta:

```html
<script src="https://raw.githack.com/emillio-santos/SupabaseAuth/main/SupabaseAuth.js"></script>
```
*Sempre que você der `git push origin main`, essa URL atualizará no seu navegador em menos de 2 minutos!*

#### Solução B: Limpar o cache do jsDelivr manualmente
Você pode forçar o jsDelivr a apagar a versão antiga do servidor deles usando a ferramenta oficial de limpeza:
1. Acesse: **[jsdelivr.com/tools/purge](https://www.jsdelivr.com/tools/purge)**
2. Cole a URL original lá:
   `https://cdn.jsdelivr.net/gh/emillio-santos/SupabaseAuth@main/SupabaseAuth.js`
3. Clique em **Purge**. Pronto! Eles limpam o cache global instantaneamente.

#### Solução C: Adicionar um parâmetro de versão no link
Você também pode "enganar" o cache adicionando uma interrogação no final do link antigo dentro do Header do Bubble:
```html
<script src="https://cdn.jsdelivr.net/gh/emillio-santos/SupabaseAuth@main/SupabaseAuth.js?v=1.0.2"></script>
