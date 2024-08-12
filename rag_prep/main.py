import os
from langchain.indexes import index
from langchain_core.documents import Document
from langchain_google_firestore import FirestoreVectorStore
from langchain_google_vertexai import VertexAIEmbeddings
from firestore_record_manager import FirestoreRecordManager
from langchain_community.document_loaders import UnstructuredPDFLoader

collection_name = "stargate_records"
namespace = f"firstore/{collection_name}"
record_manager = FirestoreRecordManager(namespace)

embedding = VertexAIEmbeddings(model_name="textembedding-gecko@003")
vectorstore = FirestoreVectorStore(
    collection=collection_name,
    embedding_service=embedding
)

folder_path = "stargate_documents/"
for filename in os.listdir(folder_path):
    if filename.endswith(".pdf"):
        file_path = os.path.join(folder_path, filename)
        print("Loading: ", file_path)
        loader = UnstructuredPDFLoader(file_path)
        docs = loader.load()
        print(docs[0])
        
        index(
            docs,
            record_manager,
            vectorstore,
            cleanup="incremental",
            source_id_key="source",
        )