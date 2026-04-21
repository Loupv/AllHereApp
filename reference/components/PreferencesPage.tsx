import { Bell, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { Header } from './Header';
import { BackButton } from './BackButton';
import { Card } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { useState } from 'react';
import { toast } from 'sonner@2.0.3';

interface PreferencesPageProps {
  onBack: () => void;
}

export function PreferencesPage({ onBack }: PreferencesPageProps) {
  const [notifications, setNotifications] = useState({
    dailyReminder: true,
    weeklyProgress: true,
    achievements: false,
    communityUpdates: true,
  });

  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    showQM3Score: false,
    showProgress: true,
  });

  return (
    <>
      <Header />
      <div className="fixed inset-0 bg-[#000D22] pt-[88px] pb-[72px]">
        <div className="h-full w-full overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full p-6">
            <BackButton onClick={onBack} color="blue" />
            
            <div className="space-y-6 mt-6">
              <div className="text-center space-y-2">
                <h1 className="text-blue-300">Preferences</h1>
                <p className="text-blue-400/70">Customize your experience</p>
              </div>

              {/* Notifications Section */}
              <Card className="bg-[#0A1633] border-2 border-blue-500/30 shadow-xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-900/30 p-3 rounded-xl border border-blue-500/30">
                    <Bell className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-slate-200">Notifications</h2>
                    <p className="text-slate-400 text-sm">Manage your notification preferences</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="daily-reminder" className="text-slate-300 cursor-pointer">
                        Daily Practice Reminder
                      </Label>
                      <p className="text-sm text-slate-500">
                        Get reminded to practice each day
                      </p>
                    </div>
                    <Switch
                      id="daily-reminder"
                      checked={notifications.dailyReminder}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, dailyReminder: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="weekly-progress" className="text-slate-300 cursor-pointer">
                        Weekly Progress Summary
                      </Label>
                      <p className="text-sm text-slate-500">
                        Receive your weekly progress report
                      </p>
                    </div>
                    <Switch
                      id="weekly-progress"
                      checked={notifications.weeklyProgress}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, weeklyProgress: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="achievements" className="text-slate-300 cursor-pointer">
                        Achievement Notifications
                      </Label>
                      <p className="text-sm text-slate-500">
                        Get notified when you unlock achievements
                      </p>
                    </div>
                    <Switch
                      id="achievements"
                      checked={notifications.achievements}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, achievements: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="community-updates" className="text-slate-300 cursor-pointer">
                        Community Updates
                      </Label>
                      <p className="text-sm text-slate-500">
                        Stay informed about community news
                      </p>
                    </div>
                    <Switch
                      id="community-updates"
                      checked={notifications.communityUpdates}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, communityUpdates: checked })
                      }
                    />
                  </div>
                </div>
              </Card>

              {/* Privacy Section */}
              <Card className="bg-[#0A1633] border-2 border-blue-500/30 shadow-xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-900/30 p-3 rounded-xl border border-blue-500/30">
                    <Eye className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-slate-200">Account Visibility</h2>
                    <p className="text-slate-400 text-sm">Control what others can see</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="profile-visible" className="text-slate-300 cursor-pointer">
                        Profile Visible
                      </Label>
                      <p className="text-sm text-slate-500">
                        Allow others to find your profile
                      </p>
                    </div>
                    <Switch
                      id="profile-visible"
                      checked={privacy.profileVisible}
                      onCheckedChange={(checked) =>
                        setPrivacy({ ...privacy, profileVisible: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-qm3" className="text-slate-300 cursor-pointer">
                        Show QM3 Score
                      </Label>
                      <p className="text-sm text-slate-500">
                        Display your QM3 score on the leaderboard
                      </p>
                    </div>
                    <Switch
                      id="show-qm3"
                      checked={privacy.showQM3Score}
                      onCheckedChange={(checked) =>
                        setPrivacy({ ...privacy, showQM3Score: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-500/5 transition-colors">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-progress" className="text-slate-300 cursor-pointer">
                        Show Progress
                      </Label>
                      <p className="text-sm text-slate-500">
                        Let others see your learning progress
                      </p>
                    </div>
                    <Switch
                      id="show-progress"
                      checked={privacy.showProgress}
                      onCheckedChange={(checked) =>
                        setPrivacy({ ...privacy, showProgress: checked })
                      }
                    />
                  </div>
                </div>
              </Card>

              {/* Help Section */}
              <Card className="bg-[#0A1633] border-2 border-blue-500/30 shadow-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-900/30 p-3 rounded-xl border border-blue-500/30">
                    <HelpCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-slate-200">Help</h2>
                    <p className="text-slate-400 text-sm">Get assistance and tutorials</p>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    localStorage.removeItem('hasSeenTutorial');
                    toast.success('Tutorial reset! Return to home to see it again.');
                    setTimeout(() => {
                      onBack();
                    }, 1000);
                  }}
                  variant="outline"
                  className="w-full border-blue-500/30 text-slate-300 hover:bg-blue-500/10 hover:text-blue-300 hover:border-blue-500/50 bg-transparent"
                >
                  Restart Tutorial
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
