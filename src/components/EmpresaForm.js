import React, { useState } from 'react';

const EmpresaForm = ({ onAddEmpresa }) => {
  const [nome, setNome] = useState('');
  const [avaliacao, setAvaliacao] = useState(1);
  const [comentario, setComentario] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const novaEmpresa = { nome, avaliacao, comentario };
    onAddEmpresa(novaEmpresa);
    setNome('');
    setAvaliacao(1);
    setComentario('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold">Nome da Empresa</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full p-2 mt-1 border rounded"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold">Avaliação</label>
        <select
          value={avaliacao}
          onChange={(e) => setAvaliacao(Number(e.target.value))}
          className="w-full p-2 mt-1 border rounded"
        >
          <option value={1}>1 Estrela</option>
          <option value={2}>2 Estrelas</option>
          <option value={3}>3 Estrelas</option>
          <option value={4}>4 Estrelas</option>
          <option value={5}>5 Estrelas</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold">Comentário</label>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          className="w-full p-2 mt-1 border rounded"
          rows="4"
        ></textarea>
      </div>

      <button type="submit" className="w-full py-2 px-4 bg-blue-500 text-white rounded">
        Avaliar Empresa
      </button>
    </form>
  );
};

export default EmpresaForm;
