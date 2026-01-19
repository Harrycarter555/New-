// src/constants/campaigns.ts
import { Campaign } from '../types';

export const SAMPLE_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1',
    title: 'Tech Gadgets Review',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-holding-neon-light-1238-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&auto=format&fit=crop',
    caption: 'Check out this amazing gadget! Must use #TechReview in caption',
    hashtags: '#TechReview #Gadgets #Tech',
    audioName: 'Tech Review Beat',
    goalViews: 5000,
    goalLikes: 500,
    basicPay: 50,
    viralPay: 500,
    active: true,
    bioLink: 'https://techstore.com/special'
  },
  {
    id: 'camp-2',
    title: 'Fashion Haul 2024',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-in-a-fashion-store-41046-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop',
    caption: 'New fashion collection is here! Tag @FashionBrand',
    hashtags: '#FashionHaul #Style #Outfit',
    audioName: 'Fashion Trend Music',
    goalViews: 10000,
    goalLikes: 1000,
    basicPay: 80,
    viralPay: 800,
    active: true,
    bioLink: 'https://fashionbrand.com/new'
  },
  {
    id: 'camp-3',
    title: 'Fitness Challenge',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-exercising-3987-large.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w-800&auto=format&fit=crop',
    caption: 'Join the 30-day fitness challenge! #FitnessGoals',
    hashtags: '#Fitness #Workout #Challenge',
    audioName: 'Workout Motivation',
    goalViews: 15000,
    goalLikes: 1500,
    basicPay: 100,
    viralPay: 1000,
    active: true,
    bioLink: '' // Fixed: Added missing property
  }
];

export const DEFAULT_CAMPAIGN: Campaign = {
  id: '',
  title: '',
  videoUrl: '',
  thumbnailUrl: '',
  caption: '',
  hashtags: '',
  audioName: '',
  goalViews: 0,
  goalLikes: 0,
  basicPay: 0,
  viralPay: 0,
  active: true,
  bioLink: '' // Fixed: Added missing property
};
