export interface IUserSignUpRequest {
  name: string;
  email: string;
  password: string;
  discord_id?: string;
  team_name?: string;
  team_id?: string; // if from invitation
  team_member_id?: string;
  timezone?: string;
  project_id?: string;
}
