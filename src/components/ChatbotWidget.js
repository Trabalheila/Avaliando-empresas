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

/**
 * Subcomponente: avatar arrastável e redimensionável (pinça/Ctrl+scroll).
 * Cada instância persiste a própria posição/tamanho em localStorage usando
 * uma chave por âncora (left | right). Ao clicar (sem ter arrastado),
 * dispara onActivate. Quando `flip` está ativo, a imagem é espelhada no eixo
 * X — útil para a instância da esquerda "olhar" para o conteúdo.
 */
function DraggableAvatar({ anchor = 'left', flip = false, onActivate, ariaLabel }) {
  const POS_KEY = `chatbotAvatarPos.v1.${anchor}`;
  const SIZE_KEY = `chatbotAvatarSize.v1.${anchor}`;
  const MIN_SIZE = 56;
  const MAX_SIZE = 480;
  const DRAG_THRESHOLD = 5;

  const [position, setPosition] = useState(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [size, setSize] = useState(() => {
    try {
      const raw = localStorage.getItem(SIZE_KEY);
      const n = raw ? parseFloat(raw) : NaN;
      return Number.isFinite(n) ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, n)) : null;
    } catch {
      return null;
    }
  });

  const dragStateRef = useRef(null);
  const pinchStateRef = useRef(null);
  const pointersRef = useRef(new Map());
  const toggleRef = useRef(null);
  const justDraggedRef = useRef(false);

  const clampToViewport = (left, top, w, h) => {
    const maxLeft = Math.max(0, window.innerWidth - w);
    const maxTop = Math.max(0, window.innerHeight - h);
    return {
      left: Math.min(Math.max(0, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop),
    };
  };

  const getDistance = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const persistPosition = (pos) => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
  };
  const persistSize = (s) => {
    try { localStorage.setItem(SIZE_KEY, String(s)); } catch { /* ignore */ }
  };

  const handlePointerDown = (e) => {
    if (!toggleRef.current) return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { toggleRef.current.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }

    if (pointersRef.current.size === 1) {
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
    } else if (pointersRef.current.size === 2) {
      dragStateRef.current = null;
      const rect = toggleRef.current.getBoundingClientRect();
      pinchStateRef.current = {
        baseDist: getDistance() || 1,
        baseSize: rect.width,
        baseLeft: rect.left,
        baseTop: rect.top,
      };
      justDraggedRef.current = true;
    }
  };

  const handlePointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchStateRef.current) {
      const dist = getDistance();
      if (!dist) return;
      const ratio = dist / pinchStateRef.current.baseDist;
      const next = Math.min(MAX_SIZE, Math.max(MIN_SIZE, pinchStateRef.current.baseSize * ratio));
      setSize(next);
      const baseLeft = pinchStateRef.current.baseLeft;
      const baseTop = pinchStateRef.current.baseTop;
      const { left, top } = clampToViewport(baseLeft, baseTop, next, next);
      setPosition({ left, top });
      return;
    }

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
    pointersRef.current.delete(e.pointerId);
    try { toggleRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }

    if (pointersRef.current.size < 2 && pinchStateRef.current) {
      const rect = toggleRef.current?.getBoundingClientRect();
      if (rect) {
        persistSize(rect.width);
        persistPosition({ left: rect.left, top: rect.top });
      }
      pinchStateRef.current = null;
      dragStateRef.current = null;
      justDraggedRef.current = true;
      return;
    }

    const st = dragStateRef.current;
    if (st) {
      if (st.moved) {
        const rect = toggleRef.current.getBoundingClientRect();
        const pos = { left: rect.left, top: rect.top };
        persistPosition(pos);
        setPosition(pos);
        justDraggedRef.current = true;
      }
      dragStateRef.current = null;
    }
  };

  const handleToggleClick = () => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    onActivate?.();
  };

  const handleWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const rect = toggleRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = -e.deltaY;
    const next = Math.min(MAX_SIZE, Math.max(MIN_SIZE, rect.width + delta * 0.5));
    setSize(next);
    persistSize(next);
    const { left, top } = clampToViewport(rect.left, rect.top, next, next);
    setPosition({ left, top });
    persistPosition({ left, top });
  };

  useEffect(() => {
    const onResize = () => {
      if (!position || !toggleRef.current) return;
      const rect = toggleRef.current.getBoundingClientRect();
      const next = clampToViewport(position.left, position.top, rect.width, rect.height);
      if (next.left !== position.left || next.top !== position.top) {
        setPosition(next);
        persistPosition(next);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  const toggleStyle = {
    ...(position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' } : null),
    ...(size ? { width: size, height: size, maxWidth: 'none', maxHeight: 'none' } : null),
  };

  const toggleClass = anchor === 'right'
    ? `${styles.chatbotToggle} ${styles.chatbotToggleRight}`
    : styles.chatbotToggle;
  const avatarClass = flip ? `${styles.avatar} ${styles.avatarFlipped}` : styles.avatar;

  return (
    <button
      ref={toggleRef}
      className={toggleClass}
      style={toggleStyle}
      onClick={handleToggleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      aria-label={ariaLabel}
    >
      <img src="/chatbot-avatar.png" alt="Chatbot Avatar" className={avatarClass} draggable={false} />
    </button>
  );
}

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const handleToggleOpen = () => setIsOpen((v) => !v);

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
      {/* Avatar à ESQUERDA — espelhado para "olhar" para o conteúdo. */}
      <DraggableAvatar
        anchor="left"
        flip
        onActivate={handleToggleOpen}
        ariaLabel="Abrir assistente do Trabalhei Lá (lado esquerdo — arraste para mover, pinça para redimensionar)"
      />
      {/* Avatar à DIREITA — orientação natural (já olha para o conteúdo). */}
      <DraggableAvatar
        anchor="right"
        onActivate={handleToggleOpen}
        ariaLabel="Abrir assistente do Trabalhei Lá (lado direito — arraste para mover, pinça para redimensionar)"
      />

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
