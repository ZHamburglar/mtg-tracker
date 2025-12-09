export async function GET() {
  try {
    const response = await fetch('https://api.scryfall.com/symbology');
    const data = await response.json();
    
    return Response.json(data);
  } catch (error) {
    console.error('Failed to fetch symbology from Scryfall:', error);
    return Response.json(
      { error: 'Failed to fetch symbology' },
      { status: 500 }
    );
  }
}
