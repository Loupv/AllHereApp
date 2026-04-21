import { useState } from 'react';
import { Trophy, User, TrendingUp } from 'lucide-react';
import { Header } from './Header';
import { BackButton } from './BackButton';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Separator } from './ui/separator';
import { motion } from 'motion/react';

interface LeaderboardPageProps {
  onBack: () => void;
}

interface LeaderboardUser {
  id: string;
  username: string;
  qm3Score: number;
  rank: number;
  initials: string;
}

export function LeaderboardPage({ onBack }: LeaderboardPageProps) {
  // Mock: Current user (set to null to simulate not logged in, or provide user data)
  const [currentUser] = useState<LeaderboardUser | null>({
    id: 'current',
    username: 'You',
    qm3Score: 185,
    rank: 12,
    initials: 'YO',
  });

  // Mock leaderboard data with more users for stats calculation
  const allUsers: LeaderboardUser[] = [
    { id: '1', username: 'MindfulSeeker', qm3Score: 387, rank: 1, initials: 'MS' },
    { id: '2', username: 'ZenMaster', qm3Score: 352, rank: 2, initials: 'ZM' },
    { id: '3', username: 'SilentPath', qm3Score: 318, rank: 3, initials: 'SP' },
    { id: '4', username: 'InnerPeace', qm3Score: 295, rank: 4, initials: 'IP' },
    { id: '5', username: 'CalmWaters', qm3Score: 271, rank: 5, initials: 'CW' },
    { id: '6', username: 'PeacefulMind', qm3Score: 245, rank: 6, initials: 'PM' },
    { id: '7', username: 'StillnessSeeker', qm3Score: 220, rank: 7, initials: 'SS' },
    { id: '8', username: 'TranquilSoul', qm3Score: 210, rank: 8, initials: 'TS' },
    { id: '9', username: 'QuietJourney', qm3Score: 198, rank: 9, initials: 'QJ' },
    { id: '10', username: 'SerenePath', qm3Score: 192, rank: 10, initials: 'SP' },
    { id: '11', username: 'MeditativeWay', qm3Score: 188, rank: 11, initials: 'MW' },
    { id: '12', username: 'You', qm3Score: 185, rank: 12, initials: 'YO' },
    { id: '13', username: 'CalmBreeze', qm3Score: 175, rank: 13, initials: 'CB' },
    { id: '14', username: 'SilentWave', qm3Score: 165, rank: 14, initials: 'SW' },
    { id: '15', username: 'MindfulWalker', qm3Score: 155, rank: 15, initials: 'MW' },
  ];

  const topUsers = allUsers.slice(0, 5);

  // Calculate statistics
  const totalParticipants = allUsers.length;
  const averageScore = Math.round(allUsers.reduce((sum, user) => sum + user.qm3Score, 0) / totalParticipants);
  const sortedScores = [...allUsers].map(u => u.qm3Score).sort((a, b) => b - a);
  const medianScore = sortedScores[Math.floor(sortedScores.length / 2)];

  const handleUserClick = (userId: string) => {
    // Navigate to user profile
    console.log('Navigate to profile:', userId);
  };

  return (
    <>
      <Header />
      <div className="fixed inset-0 bg-[#000D22] pt-[88px] pb-[72px]">
        <div className="h-full w-full overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full p-6">
            <BackButton onClick={onBack} color="emerald" />
            
            <div className="space-y-6 mt-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Trophy className="h-6 w-6 text-emerald-400" />
                  <h1 className="text-emerald-300">Leaderboard</h1>
                </div>
                <p className="text-emerald-400/70">Top QM3 Scores</p>
              </div>

              {/* Top 5 Leaderboard */}
              <Card className="bg-[#0A1633] border-2 border-emerald-500/30 shadow-xl overflow-hidden">
                <div className="divide-y divide-emerald-500/20">
                  {topUsers.map((user, index) => (
                    <motion.button
                      key={user.id}
                      onClick={() => handleUserClick(user.id)}
                      whileHover={{ scale: 1.02 }}
                      className="w-full p-4 flex items-center gap-4 hover:bg-emerald-500/5 transition-colors"
                    >
                      <div className="flex items-center justify-center w-10">
                        <span className={`${
                          user.rank === 1 ? 'text-yellow-400' :
                          user.rank === 2 ? 'text-slate-300' :
                          user.rank === 3 ? 'text-amber-600' :
                          'text-emerald-400/70'
                        }`}>
                          {user.rank}
                        </span>
                      </div>
                      
                      <Avatar className="h-10 w-10 border-2 border-emerald-500/30">
                        <AvatarFallback className="bg-emerald-900/40 text-emerald-300">
                          {user.initials}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 text-left">
                        <p className="text-slate-200">{user.username}</p>
                      </div>
                      
                      <Badge className="bg-emerald-900/40 text-emerald-300 border border-emerald-500/30">
                        {user.qm3Score}
                      </Badge>
                    </motion.button>
                  ))}
                </div>
              </Card>

              {/* Current User Score */}
              {currentUser && (
                <>
                  <div className="text-center text-emerald-400/50 text-sm">
                    • • •
                  </div>
                  
                  <Card className="bg-[#0A1633] border-2 border-emerald-500/50 shadow-xl">
                    <div className="p-4 flex items-center gap-4">
                      <div className="flex items-center justify-center w-10">
                        <span className="text-emerald-300">{currentUser.rank}</span>
                      </div>
                      
                      <Avatar className="h-10 w-10 border-2 border-emerald-400/50">
                        <AvatarFallback className="bg-emerald-800/60 text-emerald-200">
                          {currentUser.initials}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 text-left">
                        <p className="text-slate-200">{currentUser.username}</p>
                      </div>
                      
                      <Badge className="bg-emerald-800/60 text-emerald-200 border border-emerald-400/50">
                        {currentUser.qm3Score}
                      </Badge>
                    </div>
                  </Card>
                </>
              )}

              {!currentUser && (
                <Card className="bg-[#0A1633] border-2 border-emerald-500/20 shadow-xl">
                  <div className="p-6 text-center space-y-2">
                    <User className="h-8 w-8 text-emerald-400/40 mx-auto" />
                    <p className="text-emerald-400/70">
                      Log in to see your rank and compete
                    </p>
                  </div>
                </Card>
              )}

              {/* Statistics */}
              <Card className="bg-[#0A1633] border-2 border-emerald-500/30 shadow-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-emerald-900/30 p-3 rounded-xl border border-emerald-500/30">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-slate-200">Statistics</h2>
                    <p className="text-slate-400 text-sm">Community insights</p>
                  </div>
                </div>

                <Separator className="bg-emerald-500/20 mb-4" />

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                    <p className="text-2xl text-emerald-300 mb-1">{averageScore}</p>
                    <p className="text-xs text-slate-400">Average</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                    <p className="text-2xl text-emerald-300 mb-1">{medianScore}</p>
                    <p className="text-xs text-slate-400">Median</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
                    <p className="text-2xl text-emerald-300 mb-1">{totalParticipants}</p>
                    <p className="text-xs text-slate-400">Participants</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
