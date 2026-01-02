# Google Maps API Key Setup

To enable location name display on the Punch page, you need to add the Google Maps API key to your `.env` file.

## Steps:

1. Open the `backend/.env` file
2. Add or update the following line:
   ```
   GOOGLE_MAPS_API_KEY=your-google-maps-api-key
   ```

3. Restart your backend server for the changes to take effect

The API key will automatically:
- Load the Google Maps JavaScript API
- Convert GPS coordinates to location names (addresses)
- Store the location name in the database instead of coordinates

Note: The `.env` file is git-ignored for security reasons, so you'll need to add this manually to your local `.env` file.

