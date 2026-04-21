import { useState, useRef } from 'react';
import { User, Mail, Calendar, Award, LogOut, Trash2, Camera, Edit2 } from 'lucide-react';
import { Header } from './Header';
import { BackButton } from './BackButton';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { toast } from 'sonner@2.0.3';

interface MyAccountPageProps {
  onBack: () => void;
}

export function MyAccountPage({ onBack }: MyAccountPageProps) {
  // Mock user data
  const [user, setUser] = useState({
    username: 'MindfulJourney',
    email: 'user@allhere.com',
    initials: 'MJ',
    joinDate: 'January 2024',
    qm3Score: 185,
    completedPractices: 42,
    totalMinutes: 840,
    avatarUrl: null as string | null,
  });

  const [editingUsername, setEditingUsername] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [tempUsername, setTempUsername] = useState(user.username);
  const [tempEmail, setTempEmail] = useState(user.email);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    console.log('Logout');
  };

  const handleDeleteAccount = () => {
    console.log('Delete account');
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUser({ ...user, avatarUrl: reader.result as string });
        toast.success('Profile photo updated');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUsername = () => {
    setUser({ ...user, username: tempUsername });
    setEditingUsername(false);
    toast.success('Username updated');
  };

  const handleSaveEmail = () => {
    setUser({ ...user, email: tempEmail });
    setEditingEmail(false);
    toast.success('Email updated');
  };

  return (
    <>
      <Header />
      <div className="fixed inset-0 bg-[#000D22] pt-[88px] pb-[72px]">
        <div className="h-full w-full overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full p-6">
            <BackButton onClick={onBack} color="blue" />
            
            <div className="space-y-6 mt-6">
              <div className="text-center space-y-2">
                <h1 className="text-blue-300">My Account</h1>
                <p className="text-blue-400/70">Manage your profile and data</p>
              </div>

              {/* Profile Card */}
              <Card className="bg-[#0A1633] border-2 border-blue-500/30 shadow-xl p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24 border-4 border-blue-500/30">
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} />}
                      <AvatarFallback className="bg-blue-900/40 text-blue-300 text-2xl">
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 bg-blue-600/80 hover:bg-blue-600 text-white rounded-full p-2 border-2 border-[#0A1633] transition-colors"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  
                  <div>
                    <h2 className="text-slate-200 mb-1">{user.username}</h2>
                    <p className="text-slate-400 text-sm">{user.email}</p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar className="h-4 w-4" />
                    <span>Member since {user.joinDate}</span>
                  </div>
                </div>
              </Card>

              {/* Stats Card */}
              <Card className="bg-[#0A1633] border-2 border-blue-500/30 shadow-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-900/30 p-3 rounded-xl border border-blue-500/30">
                    <Award className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-slate-200">Your Progress</h2>
                    <p className="text-slate-400 text-sm">Track your journey</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl bg-blue-950/30 border border-blue-500/20">
                    <p className="text-2xl text-blue-300 mb-1">{user.qm3Score}</p>
                    <p className="text-xs text-slate-400">QM3 Score</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl bg-blue-950/30 border border-blue-500/20">
                    <p className="text-2xl text-blue-300 mb-1">{user.completedPractices}</p>
                    <p className="text-xs text-slate-400">Practices</p>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl bg-blue-950/30 border border-blue-500/20">
                    <p className="text-2xl text-blue-300 mb-1">{user.totalMinutes}</p>
                    <p className="text-xs text-slate-400">Minutes</p>
                  </div>
                </div>
              </Card>

              {/* Account Actions */}
              <Card className="bg-[#0A1633] border-2 border-blue-500/30 shadow-xl p-6 space-y-4">
                <div>
                  <h2 className="text-slate-200 mb-1">Account Information</h2>
                  <p className="text-slate-400 text-sm">View and manage your details</p>
                </div>

                <Separator className="bg-blue-500/20" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <User className="h-5 w-5 text-blue-400" />
                      <div className="flex-1">
                        <p className="text-slate-300 mb-1">Username</p>
                        {editingUsername ? (
                          <div className="flex gap-2">
                            <Input
                              value={tempUsername}
                              onChange={(e) => setTempUsername(e.target.value)}
                              className="bg-blue-950/30 border-blue-500/30 text-slate-300"
                            />
                            <Button
                              onClick={handleSaveUsername}
                              size="sm"
                              className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/50"
                            >
                              Save
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingUsername(false);
                                setTempUsername(user.username);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-slate-300"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-sm">{user.username}</p>
                        )}
                      </div>
                    </div>
                    {!editingUsername && (
                      <Button
                        onClick={() => setEditingUsername(true)}
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <Mail className="h-5 w-5 text-blue-400" />
                      <div className="flex-1">
                        <p className="text-slate-300 mb-1">Email</p>
                        {editingEmail ? (
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              value={tempEmail}
                              onChange={(e) => setTempEmail(e.target.value)}
                              className="bg-blue-950/30 border-blue-500/30 text-slate-300"
                            />
                            <Button
                              onClick={handleSaveEmail}
                              size="sm"
                              className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/50"
                            >
                              Save
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingEmail(false);
                                setTempEmail(user.email);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-slate-300"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-sm">{user.email}</p>
                        )}
                      </div>
                    </div>
                    {!editingEmail && (
                      <Button
                        onClick={() => setEditingEmail(true)}
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* Danger Zone */}
              <Card className="bg-[#0A1633] border-2 border-red-500/30 shadow-xl p-6 space-y-4">
                <div>
                  <h2 className="text-slate-200 mb-1">Danger Zone</h2>
                  <p className="text-slate-400 text-sm">Irreversible actions</p>
                </div>

                <Separator className="bg-red-500/20" />

                <div className="space-y-3">
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full border-blue-500/30 text-slate-300 hover:bg-blue-500/10 hover:text-blue-300 hover:border-blue-500/50 bg-transparent"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log Out
                  </Button>

                  <Button
                    onClick={handleDeleteAccount}
                    variant="outline"
                    className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50 bg-transparent"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
