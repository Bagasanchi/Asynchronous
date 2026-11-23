# Async Card Game Client

React frontend for the Async Card Game platform - an asynchronous turn-based card game built with TypeScript, React, and Tailwind CSS.

## Features

- **Authentication**: Login, registration, JWT-based authentication
- **Game Lobby**: Browse and join active games
- **Real-time Gameplay**: WebSocket integration for turn-based card battles
- **Matchmaking**: Find opponents for asynchronous games
- **Daily Runs**: Special daily challenges with leaderboards
- **Clubs**: Create and join player clubs
- **Tournaments**: Competitive tournaments with rankings
- **Leaderboards**: Track your progress against other players
- **Replays**: Watch and analyze your past games
- **Profile Management**: Customizable profiles with stats
- **Settings**: Customize your gaming experience

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **State Management**: Zustand with Immer middleware
- **Data Fetching**: TanStack Query for server state synchronization
- **Routing**: React Router v6
- **Styling**: Tailwind CSS with custom game-themed classes
- **Forms**: React Hook Form with Zod validation
- **Real-time**: Socket.io client for WebSocket connections
- **Animations**: Framer Motion for smooth UI transitions
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/
│   ├── ui/           # Reusable UI components
│   └── game/         # Game-specific components
├── pages/            # Page components
├── services/         # API and WebSocket services
├── store/           # Zustand state stores
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Key Components

### UI Components
- **Button**: Versatile button component with variants
- **Input**: Form inputs with validation and icons
- **Card**: Card containers for content
- **Modal**: Modal dialogs for confirmations
- **Toast**: Toast notifications for user feedback

### Game Components
- **GameCard**: Individual card display with rarity indicators
- **EnemyCard**: Enemy units with health and status
- **PlayerArea**: Player health, energy, and resources
- **HandArea**: Card hand with fan layout
- **ActionLog**: Turn-by-turn game log

### State Management
- **authStore**: User authentication and profile
- **gameStore**: Game state and UI state
- **toastStore**: Notification management

## API Integration

The client communicates with the backend through:
- REST API for data fetching (games, users, leaderboards, etc.)
- WebSocket for real-time game updates
- JWT tokens for authentication (stored in HttpOnly cookies)

## WebSocket Features

- Real-time game state updates
- Turn notifications
- Player actions synchronization
- Game end notifications
- Reconnection handling

## Styling

The application uses a dark theme with:
- Primary color scheme: Blue/Purple gradients
- Card-based layouts
- Smooth transitions and animations
- Responsive design for mobile and desktop

## Development

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Run ESLint

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting (if added)

## Contributing

1. Follow the existing code structure
2. Use TypeScript for all components
3. Implement proper error handling
4. Add tests for new features
5. Update documentation as needed