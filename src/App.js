import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import AuthLinkedIn from './pages/AuthLinkedIn';
import ChoosePseudonym from './pages/ChoosePseudonym';
import CompanyDetails from './pages/CompanyDetails';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth/linkedin" element={<AuthLinkedIn />} />
      <Route path="/pseudonym" element={<ChoosePseudonym />} />
      <Route path="/empresa" element={<CompanyDetails />} />
    </Routes>
  );
}
export default App;