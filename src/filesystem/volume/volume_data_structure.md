# Static-FS Volume Data Structure

Each static-fs volume stored on disk follows a really simple data structure approach. 
It is composed in 2 main parts:

- global header information
- file entries data

That data structure could be summarized as the following

```javascript
//
// Integers are 6B Big-Endian
//

// Header 
int hashSize;              // Number of bytes in the hash
byte[hashSize] hashString; // Hash value for this volume (utf-8 encoded string)

// End of header
int zero;                  // Control value (zero) for the end of the header

// All the data for on this volume are stored here starting after the header in sequence. 
// The loader took care of interpret the index and load the needed data as requested.
{
 byte[dataSize];          // Data for a given file
}
```
