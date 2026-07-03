/**
 * SupabaseAuth.js v1.0.2
 * Biblioteca de autenticação robusta para Supabase + Bubble.io
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

class SupabaseAuth {

  constructor() {

    this._version = "1.0.2";

    this._config = {
      url: "",
      anonKey: "",
      loginPage: "login",
      homePage: "inicio",
      redirectTo: null,
      debug: false,
      storageKey: "supabase.auth.token"
    };

    this._client = null;

    this._state = {
      initialized: false,
      loading: false,
      lastEvent: null
    };

    this._listeners = {};
  }

  // -------------------------
  // LOG
  // -------------------------
  _log(msg, type = "info") {
    if (!this._config.debug) return;
    console.log(`[SupabaseAuth] ${msg}`);
  }

  _error(msg, err) {
    console.error(`[SupabaseAuth ERROR] ${msg}`, err);
  }

  // -------------------------
  // STORAGE (compatível plugin)
  // -------------------------
  _syncStorage(session) {

    if (!session) {
      localStorage.removeItem(this._config.storageKey);
      return;
    }

    localStorage.setItem(
      this._config.storageKey,
      JSON.stringify({
        currentSession: session,
        expiresAt: session?.expires_at
      })
    );
  }

  // -------------------------
  // BUBBLE
  // -------------------------
  _notify(event, session) {

    this._state.lastEvent = event;

    if (typeof window.bubble_fn_auth === "function") {
      window.bubble_fn_auth(event);
    }

    if (typeof window.bubble_fn_session === "function") {
      window.bubble_fn_session(JSON.stringify({
        currentSession: session,
        expiresAt: session?.expires_at
      }));
    }

    if (typeof window.bubble_fn_user === "function") {
      window.bubble_fn_user(JSON.stringify(session?.user || null));
    }
  }

  // -------------------------
  // INIT
  // -------------------------
  async init(config = {}) {

    if (this._state.initialized) return true;

    this._config = { ...this._config, ...config };

    this._client = createClient(
      this._config.url,
      this._config.anonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    this._state.initialized = true;

    this._log("SDK iniciado");

    // Listener auth
    this._client.auth.onAuthStateChange((event, session) => {

      this._syncStorage(session);
      this._notify(event, session);

      this._log(`Evento: ${event}`);

    });

    // Restaurar sessão
    const { data: { session } } =
      await this._client.auth.getSession();

    if (session) {
      this._syncStorage(session);
      this._notify("INITIAL_SESSION", session);
      this._log("Sessão restaurada");
    }

    return true;
  }

  // -------------------------
  // READY
  // -------------------------
  async ready() {
    if (!this._state.initialized) {
      throw new Error("SupabaseAuth não inicializado");
    }
  }

  // -------------------------
  // SESSION
  // -------------------------
  async getSession() {
    const { data: { session } } =
      await this._client.auth.getSession();
    return session;
  }

  async getUser() {
    const { data: { user } } =
      await this._client.auth.getUser();
    return user;
  }

  async isLogged() {
    const session = await this.getSession();
    return !!session;
  }

  // -------------------------
  // REDIRECTS
  // -------------------------
  async requireAuth() {

    const session = await this.getSession();

    if (!session) {
      window.location.href = "/" + this._config.loginPage;
      return false;
    }

    return true;
  }

  async redirectIfLogged() {

    const session = await this.getSession();

    if (session) {
      window.location.href = "/" + this._config.homePage;
      return true;
    }

    return false;
  }

  // -------------------------
  // LOGIN GOOGLE
  // -------------------------
  async loginGoogle() {

    return await this._client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          this._config.redirectTo ||
          window.location.origin + "/" + this._config.homePage
      }
    });
  }

  // -------------------------
  // LOGIN EMAIL
  // -------------------------
  async loginEmail(email, password) {

    const { data, error } =
      await this._client.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      this._error("Login email", error);
      return { success: false, message: error.message };
    }

    return {
      success: true,
      session: data.session,
      user: data.user
    };
  }

  // -------------------------
  // SIGNUP
  // -------------------------
  async signup(email, password, metadata = {}) {

    const { data, error } =
      await this._client.auth.signUp({
        email,
        password,
        options: { data: metadata }
      });

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      user: data.user,
      session: data.session
    };
  }

  // -------------------------
  // LOGOUT (corrigido)
  // -------------------------
  async logout() {

    const { error } =
      await this._client.auth.signOut();

    if (error) {
      this._error("Logout", error);
      return { success: false, message: error.message };
    }

    this._syncStorage(null);

    return { success: true };
  }

  // -------------------------
  // PASSWORD RESET
  // -------------------------
  async recoverPassword(email) {

    const { error } =
      await this._client.auth.resetPasswordForEmail(email, {
        redirectTo:
          window.location.origin + "/" + this._config.loginPage
      });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  }

  async updatePassword(password) {

    const { error } =
      await this._client.auth.updateUser({
        password
      });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  }

  async updateUser(metadata = {}) {

    const { error } =
      await this._client.auth.updateUser({
        data: metadata
      });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  }

}

// -------------------------
// EXPORT GLOBAL
// -------------------------
window.SupabaseAuth = new SupabaseAuth();
