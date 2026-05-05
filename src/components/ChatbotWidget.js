// src/components/ChatbotWidget.js
import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/ChatbotWidget.module.css';
import { askGemini } from '../api/geminiService';
import knowledgeBase from '../chatbotKnowledge.json';

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
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Descarta posições inválidas (NaN, fora da viewport, negativas).
      // O reposicionamento fino dentro do limite acontece no useEffect de mount.
      if (
        !parsed ||
        typeof parsed.left !== 'number' ||
        typeof parsed.top !== 'number' ||
        !Number.isFinite(parsed.left) ||
        !Number.isFinite(parsed.top) ||
        parsed.left < 0 ||
        parsed.top < 0 ||
        (typeof window !== 'undefined' &&
          (parsed.left > window.innerWidth - MIN_SIZE ||
            parsed.top > window.innerHeight - MIN_SIZE))
      ) {
        localStorage.removeItem(POS_KEY);
        return null;
      }
      return parsed;
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

  // Ao montar, garante que a posição salva ainda cabe na viewport atual
  // (evita avatar "sumido" caso a janela tenha encolhido entre sessões).
  // Também limita o tamanho do avatar a no máximo 35% do menor lado da
  // viewport — evita ficar gigante em notebooks após resize por pinça.
  useEffect(() => {
    if (!toggleRef.current) return;

    const viewportLimit = Math.floor(
      Math.min(window.innerWidth, window.innerHeight) * 0.35
    );
    const dynamicMax = Math.max(MIN_SIZE, Math.min(MAX_SIZE, viewportLimit));
    if (size && size > dynamicMax) {
      setSize(dynamicMax);
      persistSize(dynamicMax);
    }

    if (position) {
      const rect = toggleRef.current.getBoundingClientRect();
      const next = clampToViewport(position.left, position.top, rect.width, rect.height);
      if (next.left !== position.left || next.top !== position.top) {
        setPosition(next);
        persistPosition(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Qualquer resposta não-vazia do Gemini é considerada válida e
      // exibida diretamente ao usuário, sem qualquer aviso adicional.
      const text = (responseText || '').trim();
      const botMessage = {
        sender: 'bot',
        text: text || 'Desculpe, não consegui processar sua pergunta no momento. Tente novamente mais tarde.',
      };

      setMessages((prevMessages) =>
        prevMessages.filter((msg) => !msg.isTyping).concat(botMessage)
      );
    } catch (error) {
      console.error('Erro ao enviar mensagem para o chatbot:', error);
      // Falha real do Gemini (rede, chave, 5xx, quota): mensagem genérica
      // e amigável, sem mencionar "base local" ou "assistente indisponível".
      setMessages((prevMessages) =>
        prevMessages
          .filter((msg) => !msg.isTyping)
          .concat({
            sender: 'bot',
            text: 'Desculpe, não consegui processar sua pergunta no momento. Tente novamente mais tarde.',
          })
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
      {/* Avatar único, ancorado à DIREITA da página. */}
      <DraggableAvatar
        anchor="right"
        onActivate={handleToggleOpen}
        ariaLabel="Abrir assistente do Trabalhei Lá (arraste para mover, pinça para redimensionar)"
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
