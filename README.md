# ⚡ SupabaseAuth.js

Uma biblioteca leve, robusta e modular criada para substituir completamente o plugin nativo do Supabase no Bubble.io, trazendo controle total da autenticação e sincronização de estado direto via código.

## ✨ Funcionalidades

- 🔐 **Multi-Provider OAuth:** Suporte a Google, Facebook, GitHub, Apple, Discord e mais com uma única linha de código.
- 🔄 **Sincronização com o Bubble:** Dispara gatilhos `bubble_fn_*` automaticamente para atualizar o estado no editor visual.
- 🛡️ **Proteção de Rotas:** Métodos nativos para travar páginas de membros ou redirecionar usuários logados.
- 🚦 **Sistema de Eventos (Pub/Sub):** Escute eventos como `SIGNED_IN`, `SIGNED_OUT` e crie lógicas customizadas.
- 🎛️ **Console Debug Mode:** Logs visuais elegantes para facilitar o desenvolvimento.

---

## 🚀 Como Instalar

### 1. Inclua o SDK do Supabase e a Biblioteca no Header do Bubble
Nas configurações da sua página ou do aplicativo (HTML Header), adicione:

```html
<!-- SDK Oficial do Supabase -->
<script src="[https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2](https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2)"></script>

<!-- SupabaseAuth.js -->
<script src="[https://cdn.jsdelivr.net/gh/SEU_USUARIO/SupabaseAuth/dist/SupabaseAuth.js](https://cdn.jsdelivr.net/gh/SEU_USUARIO/SupabaseAuth/dist/SupabaseAuth.js)"></script>
2. Inicialize o SDK
No fluxo de carregamento da página (Page Loaded) através de um elemento "Run JavaScript":

JavaScript
await SupabaseAuth.init({
    url: "[https://seu-projeto.supabase.co](https://seu-projeto.supabase.co)",
    anonKey: "sua-chave-anon",
    loginPage: "login",
    homePage: "inicio",
    debug: true // Ativa os logs estilizados no console
});
📖 Como Usar (Exemplos Rápidos)
Autenticação Social (OAuth)
JavaScript
// Login com Google
SupabaseAuth.login("google");

// Login com GitHub
SupabaseAuth.login("github");
Autenticação Tradicional e Logout
JavaScript
// Login por E-mail e Senha
await SupabaseAuth.loginEmail("usuario@email.com", "senha123");

// Logout
SupabaseAuth.logout();
Proteção de Páginas
JavaScript
// Coloque na página "Dashboard" (Se não estiver logado, vai para a página de login)
SupabaseAuth.requireAuth();

// Coloque na página de "Login" (Se já estiver logado, vai para a home)
SupabaseAuth.redirectIfLogged();
Escutando Eventos Globais
JavaScript
SupabaseAuth.on("SIGNED_IN", (session) => {
    console.log("Usuário logou!", session.user.email);
});
🧼 Integração com o Bubble.io
A biblioteca sincroniza nativamente o estado do usuário com o Bubble. Certifique-se de adicionar 3 elementos JavascripttoBubble na sua página com os seguintes nomes de funções:

bubble_fn_auth (Retorna o texto do evento: ex: "SIGNED_IN")

bubble_fn_session (Retorna o objeto da sessão)

bubble_fn_user (Retorna os dados do usuário atual)

🛠️ Propriedades de Inspeção
Você pode inspecionar o estado da biblioteca a qualquer momento pelo console:

JavaScript
SupabaseAuth.version  // "1.0.0"
SupabaseAuth.state    // { initialized: true, isLogged: true, ... }
SupabaseAuth.config   // Configurações passadas no .init()
SupabaseAuth.client   // Acesso direto ao cliente nativo do Supabase
📄 Licença
Distribuído sob a licença MIT. Veja LICENSE para mais informações.