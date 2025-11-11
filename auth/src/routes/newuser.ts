import express, { Request, Response} from 'express';
export const router = express.Router();

router.post('/api/users/newuser', async (req: Request, res: Response) => {
  // Placeholder logic for creating a new user
  const { email, password } = req.body;
  console.log(`Creating user with email: ${email}`);
  // In a real application, you would add logic to save the user to the database here

  res.status(201).send({ message: 'New user created', email });
});

router.get('/api/users/health', async (req: Request, res: Response) => {
  res.status(200).send({ status: 'User service is healthy' });
});

export { router as newUserRouter };