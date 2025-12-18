import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const processedRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent double processing (React Strict Mode) - use ref instead of state
      if (processedRef.current) {
        console.log('Already processed, skipping...');
        return;
      }
      
      if (!code) {
        toast.error('Invalid callback - no authorization code');
        navigate('/dashboard');
        return;
      }
      
      processedRef.current = true;

      try {
        // Call backend to exchange code for credentials
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('Please login first');
          navigate('/login');
          return;
        }

        // Use a direct API call since we need to send the code
        // Frontend proxy handles /api routes, so use relative path
        const apiUrl = '/api';
        
        const response = await fetch(`${apiUrl}/auth/google/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            code: code,
            state: state
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          console.error('Backend error:', errorData);
          throw new Error(errorData?.detail || errorData?.message || `Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data?.status === 'success') {
          toast.success('Google Calendar connected successfully!');
          navigate('/dashboard?calendar_connected=true');
        } else {
          throw new Error(data?.message || 'Failed to connect calendar');
        }
      } catch (error) {
        console.error('Error connecting calendar:', error);
        const errorMessage = error.message || 'Failed to connect Google Calendar';
        toast.error(errorMessage);
        navigate('/dashboard?calendar_error=true');
      }
    };

    handleCallback();
  }, [code, state, navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <div className="spinner"></div>
      <p>Connecting Google Calendar...</p>
    </div>
  );
};

export default GoogleCallback;

