//! Procedures to create and manipulate documents.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use uuid::Uuid;

use super::app::{AppError, AppState};

/// Creates a new document ref with initial content.
pub async fn new_ref(state: AppState, content: Value) -> Result<Uuid, AppError> {
    let ref_id = Uuid::now_v7();
    let query = sqlx::query!(
        "
        WITH snapshot AS (
            INSERT INTO snapshots(for_ref, content, at_time)
            VALUES ($1, $2, NOW())
            RETURNING id
        )
        INSERT INTO refs(id, head)
        VALUES ($1, (SELECT id FROM snapshot))
        ",
        ref_id,
        content
    );
    query.execute(&state.db).await?;
    Ok(ref_id)
}

/// Saves the document by overwriting the snapshot at the current head.
pub async fn autosave(state: AppState, data: RefContent) -> Result<(), AppError> {
    let RefContent { ref_id, content } = data;
    let query = sqlx::query!(
        "
        UPDATE snapshots
        SET content = $2, at_time = NOW()
        WHERE id = (SELECT head FROM refs WHERE id = $1)
        ",
        ref_id,
        content
    );
    query.execute(&state.db).await?;
    Ok(())
}

/** Saves the document by replacing the head with a new snapshot.

The snapshot at the previous head is *not* deleted.
*/
pub async fn save_snapshot(state: AppState, data: RefContent) -> Result<(), AppError> {
    let RefContent { ref_id, content } = data;
    let query = sqlx::query!(
        "
        WITH snapshot AS (
            INSERT INTO snapshots(for_ref, content, at_time)
            VALUES ($1, $2, NOW())
            RETURNING id
        )
        UPDATE refs
        SET head = (SELECT id FROM snapshot)
        WHERE id = $1
        ",
        ref_id,
        content
    );
    query.execute(&state.db).await?;
    Ok(())
}

/// Gets an Automerge document ID for the document ref.
pub async fn doc_id(state: AppState, ref_id: Uuid) -> Result<String, AppError> {
    let ack = state
        .automerge_io
        .emit_with_ack::<Vec<Option<String>>>("get_doc", ref_id)
        .unwrap();
    let mut response = ack.await?;
    let maybe_doc_id = response.data.pop().flatten();
    if let Some(doc_id) = maybe_doc_id {
        // If an Automerge doc handle for this ref already exists, return it.
        Ok(doc_id)
    } else {
        // Otherwise, fetch the content from the database and create a new
        // Automerge doc handle.
        let query = sqlx::query!(
            "
            SELECT content FROM snapshots
            WHERE id = (SELECT head FROM refs WHERE id = $1)
            ",
            ref_id
        );
        let content = query.fetch_one(&state.db).await?.content;
        let data = RefContent { ref_id, content };
        let ack = state.automerge_io.emit_with_ack::<Vec<String>>("create_doc", data).unwrap();
        let response = ack.await?;
        Ok(response.data[0].to_string())
    }
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct RefContent {
    #[serde(rename = "refId")]
    ref_id: Uuid,
    content: Value,
}
