import React from 'react';
import PropTypes from 'prop-types'; // Importando PropTypes para validar as props

function EmpresaList({ empresas }) {
  // Função para calcular a média da avaliação das empresas
  const calcularMedia = (empresa) => {
    const total = Object.values(empresa.criterios).reduce((acc, val) => acc + val, 0);
    return total / Object.values(empresa.criterios).length;
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Empresas Avaliadas</h2>
      <ul>
        {empresas.map((empresa) => (
          <li key={empresa.nome} className="mb-4 p-4 bg-gray-100 rounded-lg shadow-md">
            <p className="text-xl font-semibold">{empresa.nome}</p>
            <p className="text-md">Avaliação Média: {calcularMedia(empresa).toFixed(2)} ★</p>
            <p>Avaliação geral: {empresa.rating} estrelas</p>
            <p className="text-gray-600">{empresa.comment}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Validando as props
EmpresaList.propTypes = {
  empresas: PropTypes.arrayOf(
    PropTypes.shape({
      nome: PropTypes.string.isRequired,
      rating: PropTypes.number.isRequired,
      comment: PropTypes.string.isRequired,
      criterios: PropTypes.object.isRequired, // Valida que os critérios são um objeto
    })
  ).isRequired,
};

export default EmpresaList;
