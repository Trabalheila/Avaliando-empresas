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
      <button className={styles.chatbotToggle} onClick={() => setIsOpen(!isOpen)}>
        <img src="/chatbot-avatar.png" alt="Chatbot Avatar" className={styles.avatar} /> {/* Use o avatar que você criou */}
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
