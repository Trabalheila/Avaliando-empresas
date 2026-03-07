import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import AuthLinkedIn from './AuthLinkedIn'; // <-- Importe aqui

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth/linkedin" element={<AuthLinkedIn />} /> {/* <-- Rota que resolve a tela branca */}
    </Routes>
  );
}
export default App;