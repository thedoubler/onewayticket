# One Way Ticket - Flight Search App

A Next.js application that helps you find one-way flights from your current location using the Tequila API (Kiwi.com).

## Features

- 🌍 **Automatic Location Detection**: Gets your current location using browser geolocation
- ✈️ **Airport Discovery**: Finds nearby airports based on your coordinates
- 🔍 **Flight Search**: Searches for one-way flights from selected airports
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean, intuitive interface with Tailwind CSS

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd onewayticket
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory and add your Tequila API key:

```env
TEQUILA_API_KEY=your_tequila_api_key_here
```

**To get a Tequila API key:**

1. Go to [Kiwi.com Partners](https://partners.kiwi.com/)
2. Sign up for a free account
3. Navigate to the API section
4. Generate your API key

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

1. **Location Detection**: The app requests permission to access your location
2. **Airport Search**: Uses your coordinates to find nearby airports via the Tequila API
3. **Flight Search**: Searches for one-way flights from the selected airport
4. **Results Display**: Shows available flights with prices and booking links

## API Endpoints

- `GET /api/airports?lat={lat}&lon={lon}` - Get airports near coordinates
- `GET /api/search?flyFrom={code}&dateFrom={date}&dateTo={date}` - Search for flights

## Technologies Used

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Tequila API** - Flight data

## Browser Compatibility

- Requires location permission
- Works in modern browsers with geolocation support
- HTTPS required for location access in production

## Troubleshooting

### Location Permission Denied

- Make sure you allow location access when prompted
- Check that your browser supports geolocation
- Try refreshing the page and allowing location again

### No Flights Found

- Check that your Tequila API key is valid
- Verify the selected airport has flights on the chosen date
- Try different dates or airports

### API Errors

- Ensure your `.env.local` file has the correct API key
- Check the browser console for detailed error messages
- Verify your Tequila API account is active

## License

MIT
