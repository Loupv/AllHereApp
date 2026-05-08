import { Redirect } from 'expo-router';

/**
 * Legacy route — the QM training timer used to live at /qm-training as
 * a stack-pushed screen. After the QM tab refactor (which folded the
 * timer into the tab itself with a Guided / Unguided toggle), this URL
 * just redirects to the tab. Kept so any existing deep links / share
 * URLs still resolve.
 */
export default function QMTrainingLegacy() {
  return <Redirect href="/qm" />;
}
