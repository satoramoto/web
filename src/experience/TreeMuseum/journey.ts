import { repositorySnapshot } from '../../content/museum-repositories';
export const viewportLength = 6;
let cursor = 1.8;
export const chapters = repositorySnapshot.groups.map((group, chapterIndex) => {
  const worldY = cursor;
  cursor += 2;
  const projects = group.repos.map((repo, index) => {
    const project = { ...repo, worldY: cursor, side: (index + chapterIndex) % 2 ? 1 : -1, reach: .17 + (index % 3) * .025 };
    cursor += [1.5, 1.95, 1.7, 2.25][index % 4];
    return project;
  });
  cursor += 3.5;
  return { owner: group.owner, count: group.count, worldY, projects };
});
export const projects = chapters.flatMap(chapter => chapter.projects);
export const journeyLength = Math.ceil((cursor + 2) / viewportLength) * viewportLength;
export const wrapJourney = (worldY: number) => ((worldY % journeyLength) + journeyLength) % journeyLength;
// Smooth periodic centerline, shared by native waveform and repository attachments.
export function spinePathX(worldY: number) {
  const phase = wrapJourney(worldY) / journeyLength * Math.PI * 2;
  return Math.sin(phase * 3) * .34 + Math.sin(phase * 7 + .8) * .18 + Math.cos(phase * 11) * .07;
}
