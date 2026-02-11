import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/lib/auth';
import { Radio } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (login(username, password)) {
      navigate('/broadcast');
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Radio className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">QueTal Cast</h1>
          <p className="text-sm text-muted-foreground mt-1">WebRTC peer-to-peer audio</p>
        </div>

        <form onSubmit={handleSubmit} className="panel space-y-4">
          <div>
            <label className="stat-label block mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label className="stat-label block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {error && (
            <div className="text-xs font-mono text-destructive">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign In
          </button>

          <p className="text-[10px] text-muted-foreground text-center font-mono">
            MVP: admin / admin
          </p>
        </form>

        <div className="flex gap-2 mt-4 justify-center">
          <button
            onClick={() => { if (login('admin', 'admin')) navigate('/broadcast'); }}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            → Broadcaster
          </button>
          <span className="text-muted-foreground/30">|</span>
          <button
            onClick={() => { if (login('admin', 'admin')) navigate('/receive'); }}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            → Receiver
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
