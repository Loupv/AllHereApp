import {
  BookOpen,
  Brain,
  Cpu,
  User,
  Calendar,
  ExternalLink,
  Linkedin,
  Instagram,
  Youtube,
} from "lucide-react";
import { Card } from "./ui/card";
import { Header } from "./Header";
import { BackButton } from "./BackButton";
import { motion } from "motion/react";

interface AboutUsPageProps {
  onBack: () => void;
}

export function AboutUsPage({ onBack }: AboutUsPageProps) {
  const news = [
    {
      date: "October 2024",
      title: "New Research on Meditation and Mental Health",
      excerpt:
        "Recent studies show significant improvements in mental wellbeing through consistent meditation practice.",
      image: "https://images.unsplash.com/photo-1655970580622-4a547789c850?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpdGF0aW9uJTIwcmVzZWFyY2glMjBzY2llbmNlfGVufDF8fHx8MTc2MTkyMjc5MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    },
    {
      date: "September 2024",
      title: "Community Milestone: 10,000 Practitioners",
      excerpt:
        "We celebrate reaching 10,000 active practitioners in our global meditation community.",
      image: "https://images.unsplash.com/photo-1632580254134-94c4a73dab76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBwZW9wbGUlMjBnYXRoZXJpbmd8ZW58MXx8fHwxNzYxOTIyNzkxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    },
    {
      date: "August 2024",
      title: "Technology Update: Enhanced Audio Experience",
      excerpt:
        "New audio processing technology delivers even more immersive guided meditation sessions.",
      image: "https://images.unsplash.com/photo-1658927420987-488ade098001?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm9sb2d5JTIwYXVkaW8lMjBoZWFkcGhvbmVzfGVufDF8fHx8MTc2MTkyMjc5MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    },
    {
      date: "July 2024",
      title: "Founder Interview: The Vision Behind All Here",
      excerpt:
        "An in-depth conversation about bringing ancient wisdom to modern minds through technology.",
      image: "https://images.unsplash.com/photo-1497184091687-09d30ae055e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBtZWRpdGF0aW9uJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzYxOTIyNzkxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    },
  ];

  return (
    <>
      <Header />
      <div className="fixed inset-0 bg-[#0A1128] pt-[88px] pb-[72px]">
        <div className="h-full w-full overflow-y-auto">
          {/* Hero Image Section */}
          <div className="relative h-72 w-full overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1480815403196-35682b6f6a76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWVwJTIwbmlnaHQlMjBzdGFycyUyMG1pbGt5JTIwd2F5fGVufDF8fHx8MTc2MTgzNDQwMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
              }}
              animate={{
                opacity: [1, 0.5, 1],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-pink-950/20 to-purple-950/30" />
            {/* Progressive gradient overlay for readability */}
            <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0A1128] via-[#0A1128]/70 via-[#0A1128]/40 to-transparent" />
          </div>

          <div className="max-w-4xl mx-auto w-full p-6 -mt-64 relative z-10">
            <div className="mb-4">
              <BackButton onClick={onBack} color="pink" />
            </div>

            <div className="text-center space-y-2 mb-8">
              <h1 className="text-pink-300 uppercase tracking-wider drop-shadow-lg">
                About All Here
              </h1>
              <p className="text-pink-200/70 tracking-wider drop-shadow-md">
                Where meditation meets science and technology
              </p>
            </div>

            {/* Follow Us Section */}
            <div className="mb-12">
              <h2 className="text-slate-300 mb-4 uppercase tracking-wider text-center">
                Follow Us
              </h2>
              <div className="flex items-center justify-center gap-6">
                <a
                  href="https://www.linkedin.com/company/all-here-organization/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#0A1633] rounded-full p-4 border-2 border-pink-500/30 hover:border-pink-500/50 hover:bg-[#0D1A3D] transition-all duration-300 shadow-lg group"
                  aria-label="Follow us on LinkedIn"
                >
                  <Linkedin className="h-6 w-6 text-pink-400 group-hover:text-pink-300 transition-colors" />
                </a>
                <a
                  href="https://www.instagram.com/allhere_organization/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#0A1633] rounded-full p-4 border-2 border-pink-500/30 hover:border-pink-500/50 hover:bg-[#0D1A3D] transition-all duration-300 shadow-lg group"
                  aria-label="Follow us on Instagram"
                >
                  <Instagram className="h-6 w-6 text-pink-400 group-hover:text-pink-300 transition-colors" />
                </a>
                <a
                  href="https://www.youtube.com/@AllHere_Organization"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#0A1633] rounded-full p-4 border-2 border-pink-500/30 hover:border-pink-500/50 hover:bg-[#0D1A3D] transition-all duration-300 shadow-lg group"
                  aria-label="Follow us on YouTube"
                >
                  <Youtube className="h-6 w-6 text-pink-400 group-hover:text-pink-300 transition-colors" />
                </a>
              </div>
            </div>

            {/* News Horizontal Scroll */}
            <div className="mb-12">
              <h2 className="text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-5 w-5 text-pink-400" />
                Latest News
              </h2>
              <div
                className="flex gap-4 overflow-x-auto pb-4"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor:
                    "rgba(236, 72, 153, 0.3) transparent",
                }}
              >
                <style>{`
                  .flex.gap-4.overflow-x-auto::-webkit-scrollbar {
                    height: 8px;
                  }
                  .flex.gap-4.overflow-x-auto::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .flex.gap-4.overflow-x-auto::-webkit-scrollbar-thumb {
                    background: rgba(236, 72, 153, 0.3);
                    border-radius: 4px;
                  }
                  .flex.gap-4.overflow-x-auto::-webkit-scrollbar-thumb:hover {
                    background: rgba(236, 72, 153, 0.5);
                  }
                `}</style>
                {news.map((item, index) => (
                  <Card
                    key={index}
                    className="bg-[#0A1633] border-2 border-pink-500/30 overflow-hidden shadow-lg hover:border-pink-500/50 transition-all flex-shrink-0 w-[280px] md:w-[320px]"
                  >
                    <div className="relative w-full h-32 overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A1633]/60" />
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="text-pink-400 uppercase tracking-wider text-xs">
                        {item.date}
                      </p>
                      <h3 className="text-slate-300 text-base leading-tight">
                        {item.title}
                      </h3>
                      <p className="text-slate-400 text-sm line-clamp-2">
                        {item.excerpt}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Learn More Section */}
            <div className="space-y-3">
              <h2 className="text-slate-300 mb-4 uppercase tracking-wider">
                Learn More
              </h2>

              {/* The Practice Link */}
              <a
                href="https://allhere.org/the-practice/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between gap-3 bg-[#0A1633] rounded-xl p-4 border-2 border-pink-500/30 hover:border-pink-500/50 transition-all duration-300 text-left shadow-lg group"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-pink-400 flex-shrink-0" />
                  <div>
                    <p className="text-slate-300 uppercase tracking-wider">
                      The Practice
                    </p>
                    <p className="text-slate-500 text-sm">
                      Ancient wisdom for modern minds
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-5 w-5 text-pink-400 group-hover:text-pink-300 transition-colors" />
              </a>

              {/* The Science Link */}
              <a
                href="https://allhere.org/the-science/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between gap-3 bg-[#0A1633] rounded-xl p-4 border-2 border-pink-500/30 hover:border-pink-500/50 transition-all duration-300 text-left shadow-lg group"
              >
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-pink-400 flex-shrink-0" />
                  <div>
                    <p className="text-slate-300 uppercase tracking-wider">
                      The Science
                    </p>
                    <p className="text-slate-500 text-sm">
                      Evidence-based approach
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-5 w-5 text-pink-400 group-hover:text-pink-300 transition-colors" />
              </a>

              {/* The Technology Link */}
              <a
                href="https://allhere.org/the-technology/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between gap-3 bg-[#0A1633] rounded-xl p-4 border-2 border-pink-500/30 hover:border-pink-500/50 transition-all duration-300 text-left shadow-lg group"
              >
                <div className="flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-pink-400 flex-shrink-0" />
                  <div>
                    <p className="text-slate-300 uppercase tracking-wider">
                      The Technology
                    </p>
                    <p className="text-slate-500 text-sm">
                      Innovation meets mindfulness
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-5 w-5 text-pink-400 group-hover:text-pink-300 transition-colors" />
              </a>

              {/* The Founder Link */}
              <a
                href="https://allhere.org/the-founder/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between gap-3 bg-[#0A1633] rounded-xl p-4 border-2 border-pink-500/30 hover:border-pink-500/50 transition-all duration-300 text-left shadow-lg group"
              >
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-pink-400 flex-shrink-0" />
                  <div>
                    <p className="text-slate-300 uppercase tracking-wider">
                      The Founder
                    </p>
                    <p className="text-slate-500 text-sm">
                      Vision and mission
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-5 w-5 text-pink-400 group-hover:text-pink-300 transition-colors" />
              </a>
            </div>

            {/* Contact Info */}
            <div className="mt-8 bg-[#0A1633] rounded-xl p-6 border-2 border-pink-500/30 shadow-lg">
              <p className="text-slate-400 text-center">
                For more information, visit{" "}
                <a
                  href="https://allhere.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-400 underline hover:text-pink-300 transition-colors"
                >
                  allhere.org
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}