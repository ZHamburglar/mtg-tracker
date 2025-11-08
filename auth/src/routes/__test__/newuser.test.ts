import request from 'supertest';
import { app } from "./../../app";

describe("New User Route", () => {
  it("returns a 201 on successful user creation", async () => {
    const response = await request(app)
      .post("/api/users/newuser")
      .send({
        email: "test@example.com",
        password: "password123"
      });
    expect(response.status).toBe(201);
    expect(response.body.email).toBe("test@example.com");
  });
});