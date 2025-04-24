import React from 'react';

function EmpresaList({ empresas }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Empresas Avaliadas</h2>
      <ul>
        {empresas.map((empresa, index) => (
          <li key={index} className="mb-2">
            <p><strong>{empresa.nome}</strong></p>
            <p>Avaliação: {empresa.rating} estrelas</p>
            <p>{empresa.comment}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default EmpresaList;
