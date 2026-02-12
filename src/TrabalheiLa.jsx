// src/TrabalheiLa.js
import React, { useState } from 'react';
import { db as firebaseDb, storage, auth } from './firebase';  // Renomeando a importação de db para firebaseDb
import { ref, uploadBytes } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

function TrabalheiLa() {
  const [company, setCompany] = useState('');
  const [rating, setRating] = useState(0);
  const [aspects, setAspects] = useState({
    ambiente: false,
    gestao: false,
    beneficios: false
  });
  const [comment, setComment] = useState('');
  const [proof, setProof] = useState(null);
  const [uploading, setUploading] = useState(false);

  const toggleAspect = (key) => {
    setAspects({ ...aspects, [key]: !aspects[key] });
  };

  const handleFileChange = (e) => {
    setProof(e.target.files[0]);
  };

  const submitForm = async () => {
    try {
      setUploading(true);
      await signInAnonymously(auth);
      let proofUrl = '';

      if (proof) {
        const storageRef = ref(storage, `comprovantes/${Date.now()}_${proof.name}`);
        await uploadBytes(storageRef, proof);
        proofUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.bucket}/o/${encodeURIComponent(storageRef.fullPath)}?alt=media`;
      }

      await addDoc(collection(firebaseDb, 'avaliacoes'), {
        company,
        rating,
        aspects,
        comment,
        proofUrl,
        createdAt: new Date()
      });

      alert('Avaliação enviada com sucesso!');
      setCompany('');
      setRating(0);
      setAspects({ ambiente: false, gestao: false, beneficios: false });
      setComment('');
      setProof(null);
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      alert('Erro ao enviar. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-xl shadow-xl mt-10">
      <h1 className="text-4xl font-bold text-center text-blue-600 mb-8">Trabalhei lá — Avaliação de Empresas</h1>

      <div className="space-y-6">
        {/* Nome da Empresa */}
        <input
          type="text"
          placeholder="Nome da empresa"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="w-auto px-4 py-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Avaliação */}
        <div>
          <p className="font-semibold mb-2">Nota:</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((num) => (
              <span
                key={num}
                className={`w-8 h-8 cursor-pointer ${rating >= num ? 'text-yellow-500' : 'text-gray-300'}`}
                onClick={() => setRating(num)}
              >
                ⭐
              </span>
            ))}
          </div>
        </div>

        {/* Aspectos */}
        <div>
          <p className="font-semibold mb-2">Aspectos marcantes:</p>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(aspects).map((key) => (
              <button
                key={key}
                className={`px-4 py-2 text-white rounded-lg border ${aspects[key] ? 'bg-blue-500' : 'bg-gray-300'}`}
                onClick={() => toggleAspect(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Comentário */}
        <textarea
          placeholder="Comentário (opcional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-auto px-4 py-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Comprovante */}
        <div>
          <p className="font-semibold mb-2">Comprovante (PDF, imagem, etc):</p>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="w-auto px-4 py-2 border-2 border-gray-300 rounded-lg"
          />
        </div>

        {/* Botão de Envio */}
        <button
          onClick={submitForm}
          disabled={uploading}
          className="w-auto py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {uploading ? 'Enviando...' : 'Enviar Avaliação'}
        </button>
      </div>
    </div>
  );
}

export default TrabalheiLa;

