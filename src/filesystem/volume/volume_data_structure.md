# Static-FS Volume Data Structure

Each static-fs volume stored on disk follows a really simple data structure approach. 
It is composed in 2 main parts:

- global header information
- file entries data

That data structure could be summarized as the following

```javascript
// all integers are six-byte-big-endian values

// header information 
int hashSize;              // number of bytes in the hashString
byte[hashSize] hashString; // utf-8 encoded string for configuration file hashing

int zero;                  // 0 -- indicating the end of the header

// starting after the header, the data streams are laid out one after another 
// the loader took care of interpret the index  and load the needed data as requested.
{
 byte[dataSize];          // each file data
}
```
