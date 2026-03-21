import { Octokit } from "@octokit/rest";
import { config } from "../../config.js";

export function createGithubClient(): Octokit {
  return new Octokit({
    auth: config.githubToken,
    baseUrl: config.githubApiBase,
  });
}
