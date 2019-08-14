# Static-FS Volume Data Structure

Each static-fs volume stored on disk follows a really simple data structure approach. 
It is composed in 3 main parts:

- global header information
- file entries index
- file entries data

That data structure could be summarized as the following

```javascript
// all integers are six-byte-big-endian values

// header information 
int dataOffset;            // offset in the file where the data streams are.
int hashSize;              // number of bytes in the hashString
byte[hashSize] hashString; // utf-8 encoded string for configuration file hashing

// the index is a list of file entries. 
{
 int nameSize;            // the size of the filename. (0 marks the end of the index. -- see 'zero')
 int dataSize;            // the length of the dataStream. 
 byte[nameSize] filename; // utf-8 encoded string for the filename
}

int zero;                  // 0 -- indicating the end of the index

// starting at dataOffset, the data streams are laid out one after another 
// the loader builds the index in memory and calculates the offset while it loads the index.
{
 byte[dataSize];          // each file data
}
```
