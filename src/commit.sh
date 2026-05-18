set -e

echo "Staging Changes ..."
git add .


read -p "Enter commit message: " message
echo "Commiting Changes..."
git commit -m "$message"

read -p "Do you want to push Changes? (y/n) " choice

if [ "$choice" = "y" ]; then
    echo "pulling latest changes..."
    git pull
    echo "Pushing Changes..."
    git push
else 
    echo "Changes not pushed."
fi
