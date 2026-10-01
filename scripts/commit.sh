set -e

git add .

read -p "Enter message: " message

git commit -m "$message"

read -p "u wanna push? " choice
if [ "$choice" = "y" ]; then
  echo "pushing changes..."
  git push -q
else
  clear
  echo "push cancelled"
fi
