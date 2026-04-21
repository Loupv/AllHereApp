export type NewsArticle = {
  id: string;
  eyebrow: string;
  title: string;
  excerpt: string;
  date: string;
  image: number;
  body: string[];
};

export const newsArticles: NewsArticle[] = [
  {
    id: 'n1',
    eyebrow: 'Update',
    title: 'A Meaningful Step in our Journey of Understanding Meditation',
    excerpt: '✨ A meaningful step in our journey of understanding meditation Recently, our team visited Ananda Village in Nevada City, near Sacramento, California, where we…',
    date: '2026-04-13',
    image: require('../../assets/images/news/01-a-meaningful-step-in-our-journey-of-unde.png'),
    body: [
      '✨ A meaningful step in our journey of understanding meditation',
      'Recently, our team visited Ananda Village in Nevada City, near Sacramento, California, where we had the rare privilege of conducting EEG recordings with highly experienced practitioners following the teachings of Yogananda—an opportunity few scientists ever encounter.',
      'We are profoundly grateful to the community leaders for entrusting us with their most seasoned practitioners—a level of openness and trust we deeply value.',
      'Mapping the Neural Fingerprint of Paramhansa Yogananda',
      'What truly stood out was the practitioners’ unwavering engagement during the recordings. Many of the sessions lasted nearly two hours—an extraordinary display of dedication and generosity. For our research, such sustained recordings are invaluable, offering a continuous window into the evolving dynamics of meditation.'
    ],
  },
  {
    id: 'n2',
    eyebrow: 'Session',
    title: 'The San Francisco Bay Area meditation community blew us away.',
    excerpt: 'Diverse meditation lineages. One study. Real-time brain activity. Last weekend we hosted our first Quantified Meditation Sessions in the United States. Advance…',
    date: '2026-03-30',
    image: require('../../assets/images/news/02-the-san-francisco-bay-area-meditation-co.png'),
    body: [
      'Diverse meditation lineages. One study. Real-time brain activity.',
      'Last weekend we hosted our first Quantified Meditation Sessions in the United States.',
      'Advanced meditators from Soto Zen, Kriya Yoga, Mindfulness, Theravada, and more joined us to have their practice observed and quantified using All Here’s neuroscience-driven indexes.',
      '– Three days of deep meditation, real-time brainwave visualization and live explanations from our science team. – Engaging Q&A — participants exchanged ideas with the All Here & World Meditation League team about attention, self-awareness, and the neural dynamics of meditation. – Rich data — we’re back in the lab analyzing the distinctive neural signatures produced by each practice.',
      'Every session reinforced our purpose and reminded us why we do this.'
    ],
  },
  {
    id: 'n3',
    eyebrow: 'Session',
    title: 'Quantified Meditation Session | San Francisco | March 20-23, 2026',
    excerpt: 'All Here and World Meditation League in San Francisco Discover the Depth of Your Meditation Practice This March in San Francisco, All Here and the World Medita…',
    date: '2026-03-13',
    image: require('../../assets/images/news/03-quantified-meditation-session-san-franci.png'),
    body: [
      'All Here and World Meditation League in San Francisco Discover the Depth of Your Meditation Practice',
      'This March in San Francisco, All Here and the World Meditation League invite meditators with 2+ years of regular practice to take part in our upcoming Quantified Meditation™ Sessions for the opportunity to explore the depth of their practice.',
      'Advance your practice and contribute to Meditation Science',
      'Using research-grade 64 channel EEG, dynamic neuroimaging and brain-computer interface technology, your meditation will be measured in real time, interpreted and translated into visual patterns that reveal the neural dynamics of your practice.',
      'Your meditation depth will be quantified using All Here’s science-validated metrics, including: • Concentration & Mindfulness Index (CMI), which measures attention, self-awareness, and reduction of mind-wandering. • Silent Mind Index (SMI), which signals the ascent towards the Silence of Mind —a state of deep meditation of sustained inner silence and clarity.'
    ],
  },
  {
    id: 'n4',
    eyebrow: 'Research',
    title: 'Meditation, Self-Consciousness, and Mixed Reality',
    excerpt: 'EPFL x All Here Science Paper published in NeuroImage. We are pleased to share a significant scientific publication on meditation within the Mixed Reality Medi…',
    date: '2026-02-06',
    image: require('../../assets/images/news/04-meditation-self-consciousness-and-mixed-.png'),
    body: [
      'EPFL x All Here Science Paper published in NeuroImage.',
      'We are pleased to share a significant scientific publication on meditation within the Mixed Reality Meditation Platform, titled:',
      '“ Meditation in the Third-Person Perspective Modulates Minimal Self and Heartbeat-Evoked Potentials. ”',
      'How Neuroscience and Technology Are Shaping the Future of Inner Experience',
      'In recent years, meditation has moved from the margins of spiritual practice into the center of scientific inquiry. What was once primarily explored through introspection and tradition is now being studied using the most advanced tools of neuroscience, brain imaging, and immersive technology. A recent scientific publication marks an important milestone in this evolution, demonstrating how mixed reality can be used not only to guide meditation but also to rigorously investigate its effects on the brain and the sense of self.'
    ],
  },
  {
    id: 'n5',
    eyebrow: 'Tradition',
    title: 'Returning to the Essentials: The power of less with the Thai Forest Tradition',
    excerpt: 'Stepping into the quiet simplicity of the Thai Forest Tradition in Thailand this New Year break reminded us of what deep practice can look like when everything…',
    date: '2026-01-23',
    image: require('../../assets/images/news/05-returning-to-the-essentials-the-power-of.png'),
    body: [
      'Stepping into the quiet simplicity of the Thai Forest Tradition in Thailand this New Year break reminded us of what deep practice can look like when everything unnecessary falls away.',
      'Surrounded by nature, long walks through the forest, and extended periods of stillness, we once again witnessed the profound power of simplicity —not only calming the nervous system, but sharpening attention, clarity, and inner stability. In these environments, meditation is not something added on top of life. It is life. …',
      'Monastic Rhythm Immersion',
      'During this New Year break, Dr. Chuong Ngo visited and stayed with the forest monks, immersing in their daily rhythm to learn directly from the tradition and to exchange perspectives—practice-to-practice, experience-to-experience. This included long walking meditation through the rainforest, joining the morning alms round through the village, and taking part in the New Year celebration, where those who wished could dedicate the night to an overnight meditation. …',
      'Quantified Meditation in the Thai forest'
    ],
  },
  {
    id: 'n6',
    eyebrow: 'Research',
    title: 'ABIM 2026: Where Neuroscience’s Sharpest Minds Gather to Decode the Brain',
    excerpt: 'A premier EEG and brain imaging conference. Experts from around the world. Leading-edge findings in brain research. … Advancing Meditation Science With dynamic…',
    date: '2026-01-22',
    image: require('../../assets/images/news/06-abim-2026-where-neurosciences-sharpest-m.png'),
    body: [
      'A premier EEG and brain imaging conference. Experts from around the world. Leading-edge findings in brain research.',
      'Advancing Meditation Science',
      'With dynamic neural imaging, meditation becomes quantifiable.',
      'At ABIM 2026, All Here shared how meditation research, using EEG microstate analysis, explores brain dynamics associated with mind wandering, internal attention, and self-related processing.',
      'Mapping Meditation Depths'
    ],
  },
  {
    id: 'n7',
    eyebrow: 'Community',
    title: 'From Quantified Meditation to Bio-Computing,  All Here launches the Bio-Intelligence Initiative.',
    excerpt: 'On World Meditation Day, 21 December, All Here announced the launch of the Bio-Intelligence Initiative during an inaugural gathering of the All Here Quantified…',
    date: '2025-12-23',
    image: require('../../assets/images/news/07-from-quantified-meditation-to-bio-comput.png'),
    body: [
      'On World Meditation Day, 21 December, All Here announced the launch of the Bio-Intelligence Initiative during an inaugural gathering of the All Here Quantified Meditation Society — a research program exploring how stable, measurable states of human attention, cultivated through advanced meditation, can inform the development of energy-efficient, biologically inspired intelligence systems.',
      'As artificial intelligence systems continue to scale through increased computing power and energy consumption, All Here is advancing an alternative research pathway grounded in the principles of biological intelligence . The Bio-Intelligence Initiative investigates how coherent and low-noise neural states observed in the human brain can serve as reference models for training emerging biocomputing and bio-artificial intelligence systems , drawing in particular on the complex neural signatures observed in deep meditative states.',
      '“Biological intelligence operates with extraordinary efficiency, coherence, and adaptability,” said Erkin Bek , Founder of All Here and the World Meditation League. “Through advanced meditation, the human brain can reliably enter stable yet complex states that modern neuroscience is now able to observe and characterize with high precision. Our initiative explores how these states may help create training models and guide the development of future intelligence systems that are not only more efficient, but also more adaptive.”',
      'Attention and Self-Regulation as a Training Model for Organoids',
      'The All Here Bio-Intelligence Initiative approaches meditation not as a philosophical practice, but as a scientifically supported and repeatable method for inducing identifiable neural signatures. These signatures—associated with sustained attention, self-regulation, neural coherence, and low-noise dynamics —are studied as potential blueprints for training models in biological computing systems composed of living human neurons and stem-cell-derived organoids .'
    ],
  },
  {
    id: 'n8',
    eyebrow: 'Community',
    title: 'Welcome to All Here Quantified Meditation Society  Advancing Meditation’s New Era',
    excerpt: 'As the world marked United Nations–recognized World Meditation Day, curious minds from different meditation traditions gathered at All Here in Geneva. Brahma K…',
    date: '2025-12-22',
    image: require('../../assets/images/news/08-welcome-to-all-here-quantified-meditatio.png'),
    body: [
      'As the world marked United Nations–recognized World Meditation Day, curious minds from different meditation traditions gathered at All Here in Geneva.',
      'Brahma Kumaris practitioners sat beside Heartfulness meditators. Osho, Theravada and Transcendental Meditation® practitioners, and independent seekers, therapists, musicians, scientists. Each arrived carrying a distinct lineage, united by curiosity about science and meditation.',
      'This marked the inaugural gathering of the All Here Quantified Meditation Society.',
      'Concentration and Mindfulness Index',
      'Monika Stasytytė presented All Here’s research on meditation’s effects, highlighting microstates, dynamic neuroimaging, and integration into our Concentration and Mindfulness Index (CMI) and QM³ — a measure of sustained deep meditative states. The All Here Quantified Meditation System (QMS) computes and displays these metrics in real time.'
    ],
  },
];
