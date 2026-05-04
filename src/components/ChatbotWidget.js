// src/components/ChatbotWidget.js
import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/ChatbotWidget.module.css'; // Crie este arquivo CSS

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
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');

    // Adiciona uma mensagem de "digitando..." enquanto espera a resposta
    const typingMessage = { sender: 'bot', text: 'Digitando...', isTyping: true };
    setMessages((prevMessages) => [...prevMessages, typingMessage]);

    try {
      const response = await fetch('/api/chat-gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botMessage = { sender: 'bot', text: data.response };

      setMessages((prevMessages) =>
        prevMessages.filter((msg) => !msg.isTyping).concat(botMessage)
      );
    } catch (error) {
      console.error('Erro ao enviar mensagem para o chatbot:', error);
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => !msg.isTyping).concat({ sender: 'bot', text: 'Desculpe, tive um problema ao processar sua solicitação.' })
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
