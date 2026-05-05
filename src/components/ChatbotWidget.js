// src/components/ChatbotWidget.js
import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/ChatbotWidget.module.css';
import { askGemini } from '../api/geminiService';
import knowledgeBase from '../chatbotKnowledge.json';

const STOP_WORDS = new Set([
  'a','o','os','as','de','do','da','dos','das','um','uma','uns','umas',
  'e','ou','que','qual','quais','para','por','com','sem','no','na','nos','nas',
  'meu','minha','seus','suas','eu','voce','você','é','sao','são','ser','ter',
  'como','onde','quando','quem','porque','por que','isso','essa','esse','isto'
]);

const normalize = (s) =>
  (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

const tokenize = (s) =>
  normalize(s)
    .split(/\s+/)
    .filter((w) => w && w.length > 2 && !STOP_WORDS.has(w));

const findLocalAnswer = (question, kb) => {
  if (!Array.isArray(kb) || !kb.length) return '';
  const qTokens = tokenize(question);
  if (!qTokens.length) return '';
  let best = { score: 0, resposta: '' };
  for (const item of kb) {
    if (!item?.pergunta || !item?.resposta) continue;
    const pTokens = new Set(tokenize(item.pergunta));
    let score = 0;
    for (const t of qTokens) if (pTokens.has(t)) score += 1;
    if (score > best.score) best = { score, resposta: item.resposta };
  }
  return best.score >= 1 ? best.resposta : '';
};

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // ── Drag-and-drop do avatar ──────────────────────────────────────────────
  // Posição persistida em localStorage. Quando null, cai no CSS default
  // (bottom-left). Inline-style sobrescreve com top/left absolutos.
  const POS_KEY = 'chatbotAvatarPos.v1';
  const [position, setPosition] = useState(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const dragStateRef = useRef(null); // { startX, startY, baseLeft, baseTop, moved }
  const toggleRef = useRef(null);
  const DRAG_THRESHOLD = 5; // px — abaixo disso é considerado clique

  const clampToViewport = (left, top, w, h) => {
    const maxLeft = Math.max(0, window.innerWidth - w);
    const maxTop = Math.max(0, window.innerHeight - h);
    return {
      left: Math.min(Math.max(0, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop),
    };
  };

  const handlePointerDown = (e) => {
    if (!toggleRef.current) return;
    // Apenas botão esquerdo do mouse / toque primário.
    if (e.button !== undefined && e.button !== 0) return;

    const rect = toggleRef.current.getBoundingClientRect();
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseLeft: rect.left,
      baseTop: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    try {
      toggleRef.current.setPointerCapture?.(e.pointerId);
    } catch { /* ignore */ }
  };

  const handlePointerMove = (e) => {
    const st = dragStateRef.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    st.moved = true;
    const { left, top } = clampToViewport(
      st.baseLeft + dx,
      st.baseTop + dy,
      st.width,
      st.height
    );
    setPosition({ left, top });
  };

  const handlePointerUp = (e) => {
    const st = dragStateRef.current;
    if (!st) return;
    try {
      toggleRef.current?.releasePointerCapture?.(e.pointerId);
    } catch { /* ignore */ }
    if (st.moved) {
      // Persiste a posição final.
      try {
        const rect = toggleRef.current.getBoundingClientRect();
        const pos = { left: rect.left, top: rect.top };
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
        setPosition(pos);
      } catch { /* ignore */ }
    }
    // Se não houve movimento, deixa o onClick disparar normalmente.
    dragStateRef.current = null;
  };

  const handleToggleClick = () => {
    // Bloqueia o "click" sintético quando acabou de arrastar.
    // dragStateRef já foi limpo no pointerup, mas guardamos uma marca rápida.
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setIsOpen((v) => !v);
  };
  const justDraggedRef = useRef(false);

  // Mantém a marca "acabei de arrastar" para o click subsequente ignorar.
  const handlePointerUpWrapped = (e) => {
    const moved = dragStateRef.current?.moved;
    handlePointerUp(e);
    if (moved) justDraggedRef.current = true;
  };

  // Reposiciona se a janela diminuir e o avatar ficar fora da viewport.
  useEffect(() => {
    const onResize = () => {
      if (!position || !toggleRef.current) return;
      const rect = toggleRef.current.getBoundingClientRect();
      const next = clampToViewport(position.left, position.top, rect.width, rect.height);
      if (next.left !== position.left || next.top !== position.top) {
        setPosition(next);
        try { localStorage.setItem(POS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [position]);

  const toggleStyle = position
    ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' }
    : undefined;
  // ─────────────────────────────────────────────────────────────────────────

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === '') return;

    const userMessage = { sender: 'user', text: input };
    const currentInput = input;
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');

    // Adiciona uma mensagem de "digitando..." enquanto espera a resposta
    const typingMessage = { sender: 'bot', text: 'Digitando...', isTyping: true };
    setMessages((prevMessages) => [...prevMessages, typingMessage]);

    try {
      const responseText = await askGemini(currentInput, knowledgeBase);
      const botMessage = {
        sender: 'bot',
        text: responseText || 'Desculpe, não consegui formular uma resposta.',
      };

      setMessages((prevMessages) =>
        prevMessages.filter((msg) => !msg.isTyping).concat(botMessage)
      );
    } catch (error) {
      console.error('Erro ao enviar mensagem para o chatbot:', error);

      // Fallback local: tenta achar a melhor entrada da base de conhecimento
      // por sobreposição de palavras (sem depender da API).
      const fallback = findLocalAnswer(currentInput, knowledgeBase);
      const fallbackText = fallback
        ? `${fallback}\n\n(Resposta da base local — o assistente online está indisponível no momento.)`
        : `Desculpe, o assistente online está indisponível no momento (${error.message}). Tente reformular a pergunta ou volte daqui a pouco.`;

      setMessages((prevMessages) =>
        prevMessages
          .filter((msg) => !msg.isTyping)
          .concat({ sender: 'bot', text: fallbackText })
      );
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <>
      <button
        ref={toggleRef}
        className={styles.chatbotToggle}
        style={toggleStyle}
        onClick={handleToggleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpWrapped}
        onPointerCancel={handlePointerUpWrapped}
        aria-label="Abrir assistente do Trabalhei Lá (arraste para mover)"
      >
        <img src="/chatbot-avatar.png" alt="Chatbot Avatar" className={styles.avatar} draggable={false} />
      </button>

      {isOpen && (
        <div className={styles.chatbotWindow}>
          <div className={styles.chatbotHeader}>
            <span>Assistente Trabalhei Lá</span>
            <button onClick={() => setIsOpen(false)} className={styles.closeButton}>X</button>
          </div>
          <div className={styles.chatbotMessages}>
            {messages.length === 0 && (
              <div className={styles.initialMessage}>
                Olá! Sou o assistente do Trabalhei Lá. Pergunte-me qualquer coisa sobre a plataforma!
              </div>
            )}
            {messages.map((msg, index) => (
              <div key={index} className={`${styles.message} ${styles[msg.sender]}`}>
                {msg.isTyping ? (
                  <span className={styles.typingIndicator}>Digitando...</span>
                ) : (
                  msg.text
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className={styles.chatbotInputArea}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua pergunta..."
              className={styles.inputField}
            />
            <button onClick={handleSendMessage} className={styles.sendButton}>Enviar</button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
