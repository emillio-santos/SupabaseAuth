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

    // --- UTILS & HELPERS ---
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

    // --- BUBBLE INTEGRATION ---
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

    // --- STORAGE ---
    const _storage = {
      syncFromSupabase(session) {
        if (!session) {
          localStorage.removeItem(_config.storageKey);
          return;
        }
        localStorage.setItem(_config.storageKey, JSON.stringify(session));
      }
    };

    // --- REDIRECTS ---
    const _redirect = {
      to(page) {
        if (typeof window !== "undefined") {
          window.location.href = `/${page}`;
        }
      }
    };

    // --- API PÚBLICA ---
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

### Como aplicar a correção agora?

1. Substitua o código do seu arquivo local `SupabaseAuth.js` com o código gerado acima.
2. Salve o arquivo e faça o envio da nova versão corrigida para o GitHub abrindo seu terminal e rodando:
   ```bash
   git add .
   git commit -m "fix: corrigindo erro de digitacao no logout"
   git push origin main
   ```
3. Abra seu navegador em aba anônima (ou force a limpeza de cache) para carregar a versão corrigida da CDN e recarregue a página de testes do Bubble.

Tudo deve iniciar limpo e sem erros de sintaxe no console agora!
