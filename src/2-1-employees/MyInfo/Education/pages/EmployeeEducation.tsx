import { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

const EmployeeEducation = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const employeeId = id || searchParams.get('id');

  useEffect(() => {
    // Redirect to formal education as default
    navigate(`/my-info/education/formal?id=${employeeId}`, { replace: true });
  }, [navigate, employeeId]);

  return null;
};

export default EmployeeEducation;

