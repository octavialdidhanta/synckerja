
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const RequestForm = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to purchase request by default
    navigate('/request-form/purchase', { replace: true });
  }, [navigate]);

  return null;
};

export default RequestForm;
