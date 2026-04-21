import { useState } from 'react';
import { BackButton } from './BackButton';
import { motion } from 'motion/react';
import { Calendar } from './ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { 
  BookOpen, 
  Glasses, 
  Activity, 
  FileText, 
  Check,
  Calendar as CalendarIcon,
  CreditCard,
  Clock,
  Target,
  Brain,
  Heart,
  Sparkles,
  Zap,
  TrendingUp,
  Award,
  Users,
  Leaf
} from 'lucide-react';

interface SixWeeksPageProps {
  onBack: () => void;
}

interface WeekContent {
  week: number;
  title: string;
  focus: string;
  features: string[];
  icon: any;
}

export function SixWeeksPage({ onBack }: SixWeeksPageProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);

  const programFeatures = [
    {
      icon: BookOpen,
      title: 'Learn',
      description: 'Access to comprehensive meditation theory and practice courses',
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
      borderColor: 'border-blue-500/30',
      imageUrl: 'https://images.unsplash.com/photo-1766145638850-64febaa30337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpdGF0aW9uJTIwbGVhcm5pbmclMjBib29rfGVufDF8fHx8MTc2ODMyMDU2OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    {
      icon: Glasses,
      title: 'VR Experience',
      description: 'Immersive virtual reality meditation sessions',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-900/20',
      borderColor: 'border-cyan-500/30',
      imageUrl: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aXJ0dWFsJTIwcmVhbGl0eSUyMGhlYWRzZXR8ZW58MXx8fHwxNzY4MjQ4OTkyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    {
      icon: Activity,
      title: 'QMS Device',
      description: 'Mobile QMS device integration for real-time feedback',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-900/20',
      borderColor: 'border-emerald-500/30',
      imageUrl: 'https://images.unsplash.com/photo-1758577515333-e71b713059f1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiaW9tZXRyaWMlMjBkZXZpY2UlMjB3ZWxsbmVzc3xlbnwxfHx8fDE3NjgzMjA1Njh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    {
      icon: FileText,
      title: 'Progress Reports',
      description: 'Detailed weekly reports tracking your meditation journey',
      color: 'text-amber-400',
      bgColor: 'bg-amber-900/20',
      borderColor: 'border-amber-500/30',
      imageUrl: 'https://images.unsplash.com/photo-1762427354397-854a52e0ded7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9ncmVzcyUyMHJlcG9ydCUyMGFuYWx5dGljc3xlbnwxfHx8fDE3NjgzMjA1Njl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
  ];

  const weeklyContent: WeekContent[] = [
    {
      week: 1,
      title: 'Foundation',
      focus: 'Understanding the basics and setting up your practice',
      features: ['Introduction to meditation', 'Device setup', 'First VR session', 'Baseline assessment'],
      icon: Sparkles,
    },
    {
      week: 2,
      title: 'Building Awareness',
      focus: 'Developing mindfulness and attention skills',
      features: ['Daily guided sessions', 'Breath awareness', 'QMS integration', 'Progress tracking'],
      icon: Brain,
    },
    {
      week: 3,
      title: 'Deepening Practice',
      focus: 'Exploring advanced techniques and longer sessions',
      features: ['Extended meditations', 'Advanced VR environments', 'Heart coherence training', 'Mid-program review'],
      icon: Heart,
    },
    {
      week: 4,
      title: 'Integration',
      focus: 'Applying mindfulness in daily life',
      features: ['Active meditation', 'Mindful movement', 'Stress response training', 'Custom programs'],
      icon: Zap,
    },
    {
      week: 5,
      title: 'Refinement',
      focus: 'Personalizing your meditation approach',
      features: ['Technique optimization', 'Advanced biofeedback', 'Personal retreat planning', 'Community connection'],
      icon: TrendingUp,
    },
    {
      week: 6,
      title: 'Mastery & Beyond',
      focus: 'Establishing sustainable long-term practice',
      features: ['Final assessment', 'Personalized plan', 'Maintenance strategies', 'Graduation & certification'],
      icon: Award,
    },
  ];

  const handleBooking = () => {
    if (selectedDate) {
      setShowPaymentInfo(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1128] relative overflow-hidden">
      {/* Animated background */}
      <motion.div
        className="fixed inset-0 z-0"
        animate={{
          background: [
            'radial-gradient(circle at 30% 40%, rgba(251, 146, 60, 0.12) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(236, 72, 153, 0.08) 0%, transparent 50%), #0A1128',
            'radial-gradient(circle at 70% 60%, rgba(236, 72, 153, 0.12) 0%, transparent 50%), radial-gradient(circle at 30% 40%, rgba(251, 146, 60, 0.08) 0%, transparent 50%), #0A1128',
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-900/20 via-amber-800/20 to-rose-900/20" />
        <div className="relative container mx-auto px-6 py-6 flex items-center gap-4">
          <BackButton onBack={onBack} />
          <div className="flex-1">
            <h1 className="text-white tracking-widest uppercase text-3xl">
              6-Weeks Program
            </h1>
            <p className="text-white/60 tracking-wide mt-1">
              Your transformative meditation journey
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-12 pb-32">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <div className="mb-6">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-orange-500/20 border border-orange-500/30">
                <Brain className="h-8 w-8 text-orange-400" />
              </div>
            </div>
            <h2 className="text-white text-4xl tracking-wide uppercase mb-3">
              Complete Wellness Journey
            </h2>
            <p className="text-white/70 tracking-wide max-w-3xl mx-auto mb-6">
              A comprehensive 6-week program combining all our tools
            </p>
          </div>
          
          <p className="text-white/80 leading-relaxed mb-6 max-w-4xl mx-auto">
            Experience a structured path to mindfulness mastery. Over six weeks, you'll gain access to 
            our complete suite of meditation tools, personalized guidance, and progress tracking to transform 
            your practice and your life.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-4 py-2">
              <Clock className="h-4 w-4 mr-2" />
              42 Days
            </Badge>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-4 py-2">
              <Target className="h-4 w-4 mr-2" />
              Full Access
            </Badge>
            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 px-4 py-2">
              <Heart className="h-4 w-4 mr-2" />
              Personal Support
            </Badge>
          </div>
        </motion.div>

        {/* What's Included */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <h2 className="text-white text-2xl tracking-wide uppercase mb-6">
            What's Included
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              >
                <Card className={`bg-white/5 ${feature.borderColor} border backdrop-blur-sm h-full hover:bg-white/10 transition-colors duration-300 overflow-hidden`}>
                  <div className="flex items-stretch h-full">
                    {/* Image on the left */}
                    <div 
                      className="w-2/5 bg-cover bg-center relative"
                      style={{ backgroundImage: `url('${feature.imageUrl}')` }}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-r ${feature.bgColor} opacity-60`} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <feature.icon className={`h-12 w-12 ${feature.color} drop-shadow-lg`} />
                      </div>
                    </div>
                    
                    {/* Content on the right */}
                    <div className="w-3/5 p-6 flex flex-col justify-center">
                      <h3 className="text-white text-xl tracking-wide mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-white/70 text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Weekly Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-12"
        >
          <h2 className="text-white text-2xl tracking-wide uppercase mb-6">
            Week by Week Journey
          </h2>
          <div className="space-y-3">
            {weeklyContent.map((week, index) => (
              <motion.div
                key={week.week}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 + index * 0.05 }}
                className="group"
              >
                <div className="flex items-center gap-4 p-4 bg-white/5 border border-orange-500/20 backdrop-blur-sm rounded-xl hover:bg-white/10 transition-all duration-300">
                  {/* Week Number Circle */}
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <week.icon className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  
                  {/* Week Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-lg tracking-wide">
                      Week {week.week}: {week.title}
                    </h3>
                    <p className="text-white/60 text-sm mt-1 line-clamp-1">
                      {week.focus}
                    </p>
                  </div>
                  
                  {/* Features as compact badges */}
                  <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                    <span className="text-white/40 text-sm">{week.features.length} activities</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Booking Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <h2 className="text-white text-2xl tracking-wide uppercase mb-6 text-center">
            Start Your Journey
          </h2>
          
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Calendar - Centered and wider */}
            <Card className="bg-white/5 border-orange-500/30 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-white tracking-wide flex items-center justify-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-orange-400" />
                  Select Your Start Date
                </CardTitle>
                <CardDescription className="text-white/70">
                  Choose when you'd like to begin your 6-week journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    className="rounded-xl border border-orange-500/20 bg-[#0A1128]/50 text-white"
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center text-white",
                      caption_label: "text-base font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 text-white",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-white/50 rounded-md w-12 font-normal text-base",
                      row: "flex w-full mt-2",
                      cell: "text-center text-base p-0 relative [&:has([aria-selected])]:bg-orange-500/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-12 w-12 p-0 font-normal aria-selected:opacity-100 text-white hover:bg-orange-500/20 rounded-md transition-colors text-base",
                      day_selected: "bg-orange-500 text-white hover:bg-orange-600 hover:text-white focus:bg-orange-500 focus:text-white",
                      day_today: "bg-white/10 text-white font-bold",
                      day_outside: "text-white/30 opacity-50",
                      day_disabled: "text-white/20 opacity-30",
                      day_range_middle: "aria-selected:bg-orange-500/20 aria-selected:text-white",
                      day_hidden: "invisible",
                    }}
                  />
                </div>
                {selectedDate && (
                  <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-white/80 text-sm text-center">
                      <strong className="text-orange-400">Program starts:</strong>{' '}
                      {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                    <p className="text-white/80 text-sm mt-2 text-center">
                      <strong className="text-orange-400">Program ends:</strong>{' '}
                      {new Date(selectedDate.getTime() + 42 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Information - Below calendar */}
            <Card className="bg-gradient-to-br from-orange-900/30 via-amber-800/20 to-rose-900/30 border-orange-500/30 backdrop-blur-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-white tracking-wide flex items-center justify-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-400" />
                  Program Investment
                </CardTitle>
                <CardDescription className="text-white/70">
                  Transform your life with comprehensive support
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="flex items-baseline gap-2 justify-center mb-2">
                    <span className="text-5xl text-white">$497</span>
                    <span className="text-white/60">one-time</span>
                  </div>
                  <p className="text-white/70 text-sm">
                    Full access to all features for 6 weeks
                  </p>
                </div>

                <Separator className="bg-white/10" />

                <div className="space-y-3">
                  <h4 className="text-white tracking-wide uppercase text-sm text-center">
                    Your Investment Includes:
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      'Complete Learn course library',
                      'Unlimited VR meditation sessions',
                      'QMS device integration & training',
                      'Weekly progress reports',
                      'Personal support & guidance',
                      'Certificate of completion',
                      'Lifetime access to course materials',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-white/80 text-sm">
                        <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={handleBooking}
                  disabled={!selectedDate}
                  className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white py-6 text-lg tracking-wide uppercase disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {selectedDate ? 'Proceed to Enrollment' : 'Select a Start Date'}
                </Button>

                {showPaymentInfo && selectedDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                  >
                    <p className="text-emerald-400 text-sm mb-2">
                      Great choice! You're one step closer to transformation.
                    </p>
                    <p className="text-white/70 text-sm">
                      Our enrollment team will contact you shortly to complete your registration. 
                      In the meantime, you can explore our Learn and Train sections to get started.
                    </p>
                  </motion.div>
                )}

                <p className="text-white/50 text-xs text-center">
                  100% satisfaction guaranteed or your money back within 14 days
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-6 text-center backdrop-blur-md z-50">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1128] via-[#0A1128]/95 to-transparent" />
        <div className="relative z-10">
          <p className="text-white/80 tracking-widest text-sm">
            TRANSFORM YOUR PRACTICE,<br />TRANSFORM YOUR LIFE.
          </p>
        </div>
      </footer>
    </div>
  );
}