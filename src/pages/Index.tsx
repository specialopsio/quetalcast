import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '@/lib/auth';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(isAuthenticated() ? '/broadcast' : '/login');
  }, [navigate]);

  return null;
};

export default Index;
