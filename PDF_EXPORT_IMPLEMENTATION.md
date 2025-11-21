# PDF Export Implementation - Server-Side Approach

## Overview
Implemented a **server-side PDF generation** system using Supabase Edge Functions. This is more reliable than native modules and works across all platforms (iOS, Android, web).

## Architecture

### 1. Supabase Edge Function (`supabase/functions/generate-pdf/index.ts`)
- **Purpose**: Converts HTML to PDF on the server
- **Technology**: Uses HTML2PDF.app API (free, no API key required)
- **Input**: HTML content + filename
- **Output**: PDF as ArrayBuffer
- **Benefits**:
  - No native dependencies
  - Works on all platforms
  - Better PDF quality
  - Easier to maintain and update

### 2. Client-Side Service (`src/utils/pdfExportService.ts`)
- **Purpose**: Generates HTML and calls Edge Function
- **Process**:
  1. Generate HTML from devotional/playbook data
  2. Call Supabase Edge Function with HTML
  3. Convert ArrayBuffer response to base64
  4. Share PDF using `react-native-share`
- **Benefits**:
  - No `react-native-html-to-pdf` dependency
  - No `react-native-fs` dependency
  - Simpler, more reliable code

## Files Created/Modified

### Created:
1. `supabase/functions/generate-pdf/index.ts` - Edge Function for PDF generation
2. `supabase/functions/_shared/cors.ts` - CORS headers helper
3. `PDF_EXPORT_IMPLEMENTATION.md` - This documentation

### Modified:
1. `src/utils/pdfExportService.ts` - Replaced native PDF generation with server-side approach
2. `src/screens/DevotionalDetailScreen.tsx` - Re-enabled PDF export button

## How It Works

### Devotional PDF Export Flow:
```
User taps share icon
  ↓
Generate HTML from devotional data
  ↓
Call Supabase Edge Function
  ↓
Edge Function calls HTML2PDF.app
  ↓
Returns PDF as ArrayBuffer
  ↓
Convert to base64 data URL
  ↓
Open native share sheet with PDF
```

### Playbook PDF Export Flow:
Same as devotional, but with playbook-specific HTML template.

## Deployment

### Deploy Edge Function:
```bash
cd supabase
supabase functions deploy generate-pdf
```

### Test Locally:
```bash
supabase functions serve generate-pdf
```

## Testing

1. **Test devotional export**:
   - Open any devotional
   - Tap the share icon (top right)
   - Should see native share sheet with PDF

2. **Test playbook export**:
   - Open any playbook
   - Tap export button
   - Should see native share sheet with PDF

## Advantages Over Native Approach

| Feature | Native (react-native-html-to-pdf) | Server-Side (Current) |
|---------|-----------------------------------|----------------------|
| **Setup** | Complex pod install, native linking | Simple Edge Function deploy |
| **Reliability** | Often breaks with RN updates | Stable, no native dependencies |
| **Platform Support** | iOS/Android only | iOS, Android, Web |
| **PDF Quality** | Limited control | Full control via HTML/CSS |
| **Maintenance** | Requires app rebuild | Update function anytime |
| **File Size** | Adds native module weight | Zero native dependencies |

## Alternative PDF Services

If HTML2PDF.app has issues, you can easily swap to:

1. **PDFShift** (paid, high quality)
   ```typescript
   const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
     method: 'POST',
     headers: {
       'Authorization': `Basic ${btoa('api:YOUR_API_KEY')}`,
     },
     body: JSON.stringify({ source: html }),
   });
   ```

2. **Puppeteer** (self-hosted, free)
   - Requires Deno Deploy with Puppeteer support
   - Best quality, full control

3. **jsPDF** (client-side, limited)
   - No server needed
   - Limited HTML support

## Troubleshooting

### Edge Function not working:
```bash
# Check function logs
supabase functions logs generate-pdf

# Test locally
curl -X POST http://localhost:54321/functions/v1/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{"html":"<h1>Test</h1>","filename":"test.pdf"}'
```

### PDF not sharing:
- Check that `react-native-share` is installed
- Verify base64 data is valid
- Check device permissions

## Future Enhancements

1. **Add caching**: Cache generated PDFs for 24 hours
2. **Add templates**: Multiple PDF styles/themes
3. **Add watermarks**: Branding on PDFs
4. **Add analytics**: Track PDF generation/sharing
5. **Add batch export**: Export multiple devotionals at once

## Cost Considerations

- **HTML2PDF.app**: Free tier (100 PDFs/month)
- **Supabase Edge Functions**: Free tier (500K requests/month)
- **Bandwidth**: Minimal (PDFs are ~50-200KB each)

For production with high volume, consider:
- Upgrading HTML2PDF.app plan
- Self-hosting Puppeteer
- Implementing PDF caching

## Support

For issues or questions:
1. Check Supabase function logs
2. Test Edge Function directly
3. Verify HTML template renders correctly
4. Check device share permissions
