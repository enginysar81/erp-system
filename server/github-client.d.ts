import { Octokit } from '@octokit/rest';

export declare function getUncachableGitHubClient(): Promise<Octokit>;