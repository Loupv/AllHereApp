import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Header } from './Header';
import { X, Mail } from 'lucide-react';

interface AuthPageProps {
  onAuthenticated: (isSignUp?: boolean) => void;
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // For demo purposes, just authenticate (not a new user)
    onAuthenticated(false);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    // For demo purposes, just authenticate (new user)
    if (signUpPassword === signUpConfirmPassword) {
      onAuthenticated(true);
    }
  };

  const handleSocialLogin = (provider: string) => {
    // For demo purposes, just authenticate (assume existing user)
    console.log(`Logging in with ${provider}`);
    onAuthenticated(false);
  };

  return (
    <>
      <Header />
      
      {/* Skip button */}
      <button
        onClick={() => onAuthenticated(true)} // Treat skip as new user for demo
        className="fixed top-6 right-6 z-[60] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
        aria-label="Skip authentication"
      >
        <X className="w-6 h-6" />
      </button>
      
      <div className="min-h-screen w-full bg-[#0A1128] flex items-center justify-center p-4 pt-[120px] pb-[120px]">
        <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-white mb-2">Welcome to All Here</h1>
          <p className="text-white/60">Your journey to mental wellness begins here</p>
        </div>

        {/* Auth Tabs */}
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10">
            <TabsTrigger 
              value="signin"
              className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/60"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger 
              value="signup"
              className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/60"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>

          {/* Sign In Form */}
          <TabsContent value="signin" className="mt-6">
            {/* Social Login Buttons */}
            <div className="flex justify-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => handleSocialLogin('Google')}
                className="p-3 rounded-lg bg-white hover:bg-white/90 transition-all"
                title="Continue with Google"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('Microsoft')}
                className="p-3 rounded-lg bg-white hover:bg-white/90 transition-all"
                title="Continue with Microsoft"
              >
                <svg className="w-6 h-6" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('Apple')}
                className="p-3 rounded-lg bg-white hover:bg-white/90 transition-all"
                title="Continue with Apple"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#000">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('Facebook')}
                className="p-3 rounded-lg bg-[#1877F2] hover:bg-[#1877F2]/90 transition-all"
                title="Continue with Facebook"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
            </div>

            <div className="relative my-6">
              <Separator className="bg-white/20" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0A1128] px-4 text-white/60">
                Or continue with email
              </span>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-white">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="your@email.com"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password" className="text-white">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-[#FFB3BA] via-[#FFDAB3] to-[#FFFFBA] text-[#0A1128] hover:opacity-90"
              >
                Sign In
              </Button>
              <button 
                type="button"
                className="w-full text-white/60 hover:text-white transition-colors"
              >
                Forgot password?
              </button>
            </form>
          </TabsContent>

          {/* Sign Up Form */}
          <TabsContent value="signup" className="mt-6">
            {/* Social Login Buttons */}
            <div className="flex justify-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => handleSocialLogin('Google')}
                className="p-3 rounded-lg bg-white hover:bg-white/90 transition-all"
                title="Continue with Google"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('Microsoft')}
                className="p-3 rounded-lg bg-white hover:bg-white/90 transition-all"
                title="Continue with Microsoft"
              >
                <svg className="w-6 h-6" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('Apple')}
                className="p-3 rounded-lg bg-white hover:bg-white/90 transition-all"
                title="Continue with Apple"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#000">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('Facebook')}
                className="p-3 rounded-lg bg-[#1877F2] hover:bg-[#1877F2]/90 transition-all"
                title="Continue with Facebook"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
            </div>

            <div className="relative my-6">
              <Separator className="bg-white/20" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0A1128] px-4 text-white/60">
                Or sign up with email
              </span>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-white">Full Name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Your name"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-white">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="your@email.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-white">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password" className="text-white">Confirm Password</Label>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={signUpConfirmPassword}
                  onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-[#BAFFC9] via-[#BAE1FF] to-[#DFB3FF] text-[#0A1128] hover:opacity-90"
              >
                Create Account
              </Button>
              <p className="text-white/40 text-center">
                By signing up, you agree to our Terms & Privacy Policy
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    
    <footer className="fixed bottom-0 left-0 right-0 py-6 text-center bg-[#0A1128] z-50 border-t border-white/10">
      <p className="text-white/70 tracking-wider">
        WHERE MEDITATION MEETS<br />SCIENCE AND TECHNOLOGY.
      </p>
    </footer>
  </>
  );
}
