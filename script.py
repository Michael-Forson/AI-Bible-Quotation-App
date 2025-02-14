import json
import os
import re
import sys
from pymongo import MongoClient

# ... [Keep all existing imports and unchanged code] ...

def generate_bible(bible_translation, show_progress=True):
    # ... [Keep all existing code up to the SQL generation part] ...
    
    # Replace SQL generation with MongoDB insertion
    in_name = root + bible_translation + "_bible.json"
    
    # MongoDB connection setup
    mongo_uri = os.getenv("MONGODB_URI", "mongodb+srv://micfor722:1234@cluster0.hugcj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
    db_name = os.getenv("MONGODB_DB", "bible_db")
    collection_name = bible_translation.lower()
    
    try:
        client = MongoClient(mongo_uri)
        db = client[db_name]
        collection = db[collection_name]
        
        # Clear existing data for this translation
        collection.delete_many({})
        
        with open(in_name, 'r') as input_file:
            cd = json.load(input_file)
            batch = []
            batch_size = 1000  # Adjust based on your needs
            
            for book_name, chapters in cd.items():
                book_id = books.index(book_name) + 1
                
                for chapter_num, verses in chapters.items():
                    for verse_num, verse_text in verses.items():
                        document = {
                            "translation": bible_translation,
                            "book_id": book_id,
                            "book": book_name,
                            "chapter": int(chapter_num),
                            "verse": int(verse_num),
                            "text": verse_text
                        }
                        
                        batch.append(document)
                        
                        # Insert in batches
                        if len(batch) >= batch_size:
                            collection.insert_many(batch)
                            batch = []
            
            # Insert remaining documents
            if batch:
                collection.insert_many(batch)
            
            if show_progress:
                print(f"\n[+] Inserted {collection.count_documents({})} documents into MongoDB collection {collection_name}")
                
    except Exception as e:
        print(f"\n[!] MongoDB Error: {str(e)}")
    finally:
        client.close()

# ... [Keep the rest of the existing code] ...