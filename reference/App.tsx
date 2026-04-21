import { useState, useEffect } from 'react';
import { AuthPage } from './components/AuthPage';
import { HomeScreen } from './components/HomeScreen';
import { BeginPage } from './components/BeginPage';
import { LearnPage } from './components/LearnPage';
import { TrainPage } from './components/TrainPage';
import { AccessPage } from './components/AccessPage';
import { ConnectPage } from './components/ConnectPage';
import { AboutUsPage } from './components/AboutUsPage';
import { SplashScreen } from './components/SplashScreen';
import { PreferencesPage } from './components/PreferencesPage';
import { MyAccountPage } from './components/MyAccountPage';
import { TutorialOverlay } from './components/TutorialOverlay';
import { LeaderboardPage } from './components/LeaderboardPage';
import { HistoryPage } from './components/HistoryPage';
import { SixWeeksPage } from './components/SixWeeksPage';

export type Page = 'home' | 'begin' | 'learn' | 'train' | 'access' | 'connect' | 'contact' | 'preferences' | 'account' | 'leaderboard' | 'history' | 'six-weeks';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [showTutorial, setShowTutorial] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Check if this is the first time the user is logging in
  useEffect(() => {
    if (isAuthenticated && !showSplash && currentPage === 'home') {
      const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
      
      // Show tutorial if either it's a new user or they haven't seen it before
      if (isNewUser || !hasSeenTutorial) {
        // Add a small delay to ensure HomeScreen is fully rendered
        const timer = setTimeout(() => {
          setShowTutorial(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, showSplash, currentPage, isNewUser]);

  const handleTutorialComplete = () => {
    localStorage.setItem('hasSeenTutorial', 'true');
    setShowTutorial(false);
    setIsNewUser(false); // Reset new user flag
  };

  const handleAuthenticated = (isSignUp: boolean = false) => {
    setIsAuthenticated(true);
    setIsNewUser(isSignUp);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomeScreen onNavigate={setCurrentPage} />;
      case 'begin':
        return <BeginPage onBack={() => setCurrentPage('home')} onNavigate={setCurrentPage} />;
      case 'learn':
        return <LearnPage onBack={() => setCurrentPage('home')} />;
      case 'train':
        return <TrainPage 
          onBack={() => setCurrentPage('home')} 
          onNavigateToLeaderboard={() => setCurrentPage('leaderboard')}
          onNavigateToHistory={() => setCurrentPage('history')}
        />;
      case 'six-weeks':
        return <SixWeeksPage onBack={() => setCurrentPage('home')} />;
      case 'access':
        return <AccessPage onBack={() => setCurrentPage('home')} />;
      case 'connect':
        return <ConnectPage onBack={() => setCurrentPage('home')} />;
      case 'contact':
        return <AboutUsPage onBack={() => setCurrentPage('home')} />;
      case 'preferences':
        return <PreferencesPage onBack={() => setCurrentPage('home')} />;
      case 'account':
        return <MyAccountPage onBack={() => setCurrentPage('home')} />;
      case 'leaderboard':
        return <LeaderboardPage onBack={() => setCurrentPage('train')} />;
      case 'history':
        return <HistoryPage onBack={() => setCurrentPage('train')} />;
      default:
        return <HomeScreen onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="h-screen w-screen overflow-y-auto bg-[#0A1128]">
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      {!showSplash && !isAuthenticated && (
        <AuthPage onAuthenticated={handleAuthenticated} />
      )}
      {!showSplash && isAuthenticated && (
        <>
          {renderPage()}
          {showTutorial && currentPage === 'home' && (
            <TutorialOverlay onComplete={handleTutorialComplete} />
          )}
        </>
      )}
    </div>
  );
}