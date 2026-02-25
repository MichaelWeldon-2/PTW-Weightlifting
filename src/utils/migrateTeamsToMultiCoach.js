import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export async function migrateTeamsToMultiCoach() {

  const snapshot = await getDocs(collection(db, "teams"));

  for (const teamDoc of snapshot.docs) {

    const data = teamDoc.data();

    // Skip if already migrated
    if (data.coaches && Array.isArray(data.coaches)) {
      console.log(`Skipping ${teamDoc.id} (already migrated)`);
      continue;
    }

    if (!data.createdBy) {
      console.log(`Skipping ${teamDoc.id} (no createdBy found)`);
      continue;
    }

    await updateDoc(doc(db, "teams", teamDoc.id), {
      coaches: [data.createdBy],
      createdBy: null
    });

    console.log(`Migrated team ${teamDoc.id}`);
  }

  console.log("✅ Migration complete");
}